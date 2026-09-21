#!/usr/bin/env python3
"""Create and populate the App Store review demo account, against a REAL API.

Not a CI script, not idempotent, not meant to run more than once: it signs up one fixed account,
creates one farm, and walks it through a broiler cycle (feed purchase and receipt, daily records,
a closed batch with a margin, a batch still in progress, a client sale/invoice/payment, a vet visit,
a supplier ledger movement, a manual expense) so an Apple reviewer opens an app that already looks
lived-in instead of an empty shell.

Usage:
    python3 scripts/seed-app-store-demo.py --base-url https://app.jawdi.app \
        --email demo.appstore@jawdi.app --password '...' [--verbose]

Exits non-zero and prints the failing call if anything answers unexpectedly — nothing here should
ever get a 4xx/5xx against a fresh farm; if it does, stop and look, don't re-run blindly (signup is
not idempotent, a second run will fail at step one with a duplicate email).
"""

from __future__ import annotations

import argparse
import datetime
import json
import sys
import urllib.error
import urllib.request


class Seeder:
    def __init__(self, base_url: str, verbose: bool = False) -> None:
        self.base = base_url.rstrip("/") + "/api/v1"
        self.verbose = verbose
        self.token: str | None = None
        self.failures: list[str] = []

    def call(self, method: str, path: str, body: dict | None = None, expect=None):
        url = self.base + path
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        if self.token:
            request.add_header("Authorization", "Bearer " + self.token)

        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                status, raw = response.status, response.read().decode()
        except urllib.error.HTTPError as exc:
            status, raw = exc.code, exc.read().decode()
        except Exception as exc:
            status, raw = 0, str(exc)

        expected = expect if expect is not None else ((200, 201) if method == "POST" else (200, 204))
        ok = status in expected
        try:
            payload = json.loads(raw) if raw else None
        except ValueError:
            payload = raw

        print(f"{'ok ' if ok else 'ERR'} {status:3} {method:6} {path}")
        if self.verbose or not ok:
            print(f"      {json.dumps(payload, ensure_ascii=False)[:500]}")

        if not ok:
            self.failures.append(f"{method} {path} -> {status} (attendu {expected})")
            print("\nArrêt : une soumission ne s'est pas passée comme prévu, voir ci-dessus.")
            sys.exit(1)

        return payload

    @staticmethod
    def unwrap(payload):
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload

    def identifier(self, payload):
        data = self.unwrap(payload)
        return data.get("id") if isinstance(data, dict) else None

    def section(self, title: str) -> None:
        print(f"\n--- {title} ---")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--farm-name", default="Ferme Démo Jawdi")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    s = Seeder(args.base_url, args.verbose)
    today = datetime.date.today()

    s.section("Inscription")
    s.call("POST", "/auth/signup", {
        "email": args.email, "password": args.password, "fullName": "Fatou Diagne",
        "phone": "+221770000099",
    })
    payload = s.call("POST", "/auth/login", {"email": args.email, "password": args.password})
    s.token = s.unwrap(payload).get("accessToken")

    s.section("Ferme")
    payload = s.call("POST", "/farms", {
        "name": args.farm_name, "location": "Thiès", "capacity": 3000, "currency": "XOF",
        "productionFocus": ["broiler", "layer"],
    })
    farm = s.identifier(payload)
    payload = s.call("POST", "/auth/login", {"email": args.email, "password": args.password})
    s.token = s.unwrap(payload).get("accessToken")
    f = f"/farms/{farm}"

    s.section("Souches")
    payload = s.call("GET", "/breeds?species=POULTRY")
    breeds = s.unwrap(payload) or []
    broiler_breed = next((b["id"] for b in breeds if b.get("type") == "broiler"), None)

    s.section("Fournisseur, achat d'aliment, réception")
    payload = s.call("POST", f + "/inventory/suppliers", {
        "commercialName": "Provendier Sahel", "phone": "+221771234567", "city": "Thiès",
    })
    supplier = s.identifier(payload)
    payload = s.call("GET", f + "/inventory/catalog/articles/all")
    articles = s.unwrap(payload) or []
    feed_article = next((a for a in articles if "aliment" in (a.get("label") or "").lower()), articles[0])
    payload = s.call("POST", f + "/inventory/purchase-orders", {
        "supplierId": supplier, "orderDate": (today - datetime.timedelta(days=38)).isoformat(),
        "lines": [{
            "articleKey": feed_article["articleKey"], "articleSource": feed_article.get("articleSource", "INVENTORY"),
            "orderedQuantity": 800, "unitPriceXof": 350,
        }],
    })
    order = s.unwrap(payload)
    order_id = order.get("id")
    line = order["items"][0]
    s.call("POST", f + f"/inventory/purchase-orders/{order_id}/submit", {})
    s.call("POST", f + f"/inventory/purchase-orders/{order_id}/receive", {
        "actualDeliveryDate": (today - datetime.timedelta(days=37)).isoformat(),
        "lines": [{"itemId": line["id"], "receivedQuantity": 800}],
    })

    s.section("Bande 1 (35 jours, en clôture)")
    payload = s.call("POST", f + "/poultry-batches", {
        "breedId": broiler_breed, "name": "Bande A", "startDate": (today - datetime.timedelta(days=35)).isoformat(),
        "initialCount": 500, "targetWeightG": 2200, "targetAgeDays": 42,
    })
    batch_a = s.identifier(payload)
    ba = f + f"/poultry-batches/{batch_a}"
    feed_plan = [(30, 15.0, 5), (25, 40.0, 3), (18, 70.0, 4), (10, 95.0, 2), (3, 60.0, 1)]
    for days_ago, feed_kg, mortality in feed_plan:
        s.call("POST", ba + "/daily-records", {
            "recordDate": (today - datetime.timedelta(days=days_ago)).isoformat(),
            "mortalityCount": mortality, "feedKg": feed_kg, "waterL": feed_kg * 1.6,
            "feedConsumption": {
                "articleKey": feed_article["articleKey"],
                "articleSource": feed_article.get("articleSource", "INVENTORY"),
                "quantity": feed_kg,
            },
        })
    s.call("POST", ba + "/weighings", {
        "sampleDate": (today - datetime.timedelta(days=3)).isoformat(),
        "individualWeights": [2150, 2230, 2080, 2260, 2190, 2210, 2140],
    })

    s.section("Client, vente sur la Bande 1, facture, paiement")
    payload = s.call("POST", f + "/commercial/clients", {
        "clientType": "INDIVIDUAL", "displayName": "Boutique Awa", "phone": "+221779876543",
        "creditLimitXof": 400000,
    })
    client = s.identifier(payload)
    payload = s.call("POST", f + "/commercial/sales", {
        "clientId": client, "saleDate": (today - datetime.timedelta(days=2)).isoformat(),
        "paymentMethod": "CASH",
        "lines": [{
            "articleKey": "poulet-vif-bande-a", "articleSource": "PRODUCTION",
            "quantity": 420, "unitPriceXof": 2600, "productionUnitId": batch_a, "productType": "BROILER",
        }],
    })
    sale = s.identifier(payload)
    payload = s.call("POST", f + "/commercial/invoices/from-sale", {"saleId": sale})
    invoice = s.identifier(payload)
    s.call("POST", f + "/commercial/payments", {
        "invoiceId": invoice, "amountXof": 420 * 2600,
        "paymentDate": (today - datetime.timedelta(days=1)).isoformat(), "method": "CASH",
    })

    s.section("Clôture de la Bande 1")
    s.call("POST", f + f"/production-units/{batch_a}/close", {
        "chickCostXof": 500 * 350, "notes": "Cycle témoin — compte de démonstration.",
    })

    s.section("Bande 2 (en cours)")
    payload = s.call("POST", f + "/poultry-batches", {
        "breedId": broiler_breed, "name": "Bande B", "startDate": (today - datetime.timedelta(days=9)).isoformat(),
        "initialCount": 350, "targetWeightG": 2200, "targetAgeDays": 42,
    })
    batch_b = s.identifier(payload)
    bb = f + f"/poultry-batches/{batch_b}"
    for days_ago, feed_kg, mortality in [(7, 12.0, 2), (3, 25.0, 1)]:
        s.call("POST", bb + "/daily-records", {
            "recordDate": (today - datetime.timedelta(days=days_ago)).isoformat(),
            "mortalityCount": mortality, "feedKg": feed_kg, "waterL": feed_kg * 1.6,
        })

    s.section("Vétérinaire")
    payload = s.call("POST", f + "/health/veterinarians", {
        "fullName": "Dr Sow", "phone": "+221338001122", "speciality": "Aviaire",
    })
    vet = s.identifier(payload)
    s.call("POST", f + "/health/vet-visits", {
        "unitId": batch_b, "veterinarianId": vet, "visitDate": (today - datetime.timedelta(days=3)).isoformat(),
        "reason": "Contrôle sanitaire", "costXof": 15000, "followUpNeeded": False,
    })

    s.section("Compte-courant fournisseur")
    s.call("POST", f + f"/inventory/suppliers/{supplier}/ledger/payments", {
        "amountXof": 150000, "entryDate": (today - datetime.timedelta(days=20)).isoformat(),
        "label": "Acompte sur livraison", "method": "MOBILE_MONEY", "notifySupplier": False,
    })

    s.section("Dépense manuelle")
    payload = s.call("GET", f + "/catalog/expense_categories")
    categories = s.unwrap(payload) or []
    if categories:
        s.call("POST", f + "/finance/expenses", {
            "categoryKey": categories[0]["key"], "amountXof": 18000,
            "expenseDate": (today - datetime.timedelta(days=5)).isoformat(), "label": "Transport aliment",
        })

    print(f"\nTerminé. Ferme #{farm}, bande close #{batch_a}, bande en cours #{batch_b}.")
    print(f"Identifiants : {args.email} / (mot de passe fourni en argument)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
