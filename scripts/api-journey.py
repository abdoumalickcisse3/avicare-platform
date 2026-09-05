#!/usr/bin/env python3
"""Replay a farmer's whole first day against a running API, and fail on anything unexpected.

Every check here comes from a defect that actually shipped. The audit of 2026-09-04 found nine
endpoints answering 500 to a missing query parameter, an unknown address answering 500 instead of
404, a portal token reading farmer reference data, and a farm you had just created answering 403 to
its own owner. Unit tests missed all of them: each one only appears when a real request crosses the
whole stack.

So this walks the platform the way an éleveur does — sign up, create the farm, open every module,
write in a few of them — and asserts the status of each call. A 5xx anywhere fails the run, whatever
the endpoint: a server error is never an acceptable answer to a well-formed request.

Usage:
    python3 scripts/api-journey.py [--base-url http://localhost:8080] [--verbose]

Exit code 0 when every call answered what it should, 1 otherwise, with a summary of the divergences.
"""

from __future__ import annotations

import argparse
import datetime
import json
import sys
import time
import urllib.error
import urllib.request

DEFAULT_BASE = "http://localhost:8080"
PASSWORD = "Parcours#2026Test"


class Journey:
    def __init__(self, base_url: str, verbose: bool = False) -> None:
        self.base = base_url.rstrip("/") + "/api/v1"
        self.verbose = verbose
        self.tokens: dict[str, str | None] = {}
        self.failures: list[str] = []
        self.count = 0

    # --- plumbing ---------------------------------------------------------

    def call(
        self,
        method: str,
        path: str,
        body: dict | None = None,
        who: str = "farmer",
        expect: tuple[int, ...] | None = None,
        note: str = "",
    ):
        url = self.base + path
        data = json.dumps(body).encode() if body is not None else None
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("Content-Type", "application/json")
        token = self.tokens.get(who)
        if token:
            request.add_header("Authorization", "Bearer " + token)

        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                status, raw = response.status, response.read().decode()
        except urllib.error.HTTPError as exc:
            status, raw = exc.code, exc.read().decode()
        except Exception as exc:  # network, DNS, refused connection
            status, raw = 0, str(exc)

        self.count += 1
        expected = expect if expect is not None else ((200, 201) if method == "POST" else (200, 204))
        ok = status in expected

        if not ok:
            detail = raw[:300].replace("\n", " ")
            self.failures.append(
                f"{method} {path} -> {status} (attendu {list(expected)})"
                + (f" [{note}]" if note else "")
                + f"\n      {detail}"
            )
        if self.verbose or not ok:
            print(f"{'ok ' if ok else 'ERR'} {status:3} {method:6} {path[:70]:70} {note}")

        try:
            return json.loads(raw), status
        except ValueError:
            return raw, status

    @staticmethod
    def unwrap(payload):
        if isinstance(payload, dict) and "data" in payload:
            return payload["data"]
        return payload

    def identifier(self, payload):
        data = self.unwrap(payload)
        return data.get("id") if isinstance(data, dict) else None

    def section(self, title: str) -> None:
        if self.verbose:
            print(f"\n--- {title} ---")

    # --- the walk ---------------------------------------------------------

    def run(self) -> int:
        stamp = int(time.time())
        today = datetime.date.today().isoformat()
        yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        email = f"parcours{stamp}@jawdi.test"

        self.section("Inscription")
        self.call("POST", "/auth/signup", {"email": email, "password": PASSWORD, "fullName": "Éleveur Parcours"})
        payload, _ = self.call("POST", "/auth/login", {"email": email, "password": PASSWORD})
        self.tokens["farmer"] = self.unwrap(payload).get("accessToken")
        if not self.tokens["farmer"]:
            self.failures.append("login n'a pas renvoyé d'accessToken — le parcours ne peut pas continuer")
            return self.report()

        self.section("Création de la ferme")
        self.call("GET", "/farms", note="aucune ferme au départ")
        payload, _ = self.call(
            "POST",
            "/farms",
            {
                "name": "Ferme Parcours",
                "location": "Thiès",
                "capacity": 5000,
                "currency": "XOF",
                "productionFocus": ["broiler", "layer"],
            },
        )
        farm = self.identifier(payload)
        if not farm:
            self.failures.append("la ferme n'a pas été créée — le parcours ne peut pas continuer")
            return self.report()

        # Memberships are minted into the token, so the token issued before the farm existed does
        # not carry it. Both clients refresh here; the journey re-logs in for the same reason.
        payload, _ = self.call("POST", "/auth/login", {"email": email, "password": PASSWORD},
                               note="le jeton doit être réémis pour porter la nouvelle ferme")
        self.tokens["farmer"] = self.unwrap(payload).get("accessToken")
        f = f"/farms/{farm}"

        self.section("Socle de la ferme")
        for path in [
            f, f + "/settings", f + "/users", f + "/dashboard", f + "/activity", f + "/thresholds",
            f + "/benchmarks", f + "/notification-preferences", f + "/notifications",
            f + "/notifications/unread-count", f + "/subscription/modules",
        ]:
            self.call("GET", path)

        self.section("Référentiels")
        payload, _ = self.call("GET", "/breeds?species=POULTRY")
        breeds = self.unwrap(payload) or []
        broiler = next((b["id"] for b in breeds if b.get("type") == "broiler"), None)
        layer = next((b["id"] for b in breeds if b.get("type") == "layer"), None)
        for category in ["breeds", "expense_categories", "sales_channels", "vaccines", "treatments"]:
            self.call("GET", f + f"/catalog/{category}")

        self.section("Élevage — chair")
        batch = None
        if broiler:
            payload, _ = self.call("POST", f + "/poultry-batches", {
                "breedId": broiler, "name": "Bande 1", "startDate": yesterday,
                "initialCount": 500, "targetWeightG": 2200, "targetAgeDays": 42,
            })
            batch = self.identifier(payload)
        self.call("GET", f + "/poultry-batches")
        if batch:
            b = f + f"/poultry-batches/{batch}"
            self.call("GET", b)
            self.call("POST", b + "/daily-records", {
                "recordDate": yesterday, "mortalityCount": 3, "feedKg": 45.5, "waterL": 90.0,
            })
            self.call("GET", b + "/daily-records")
            self.call("POST", b + "/weighings", {
                "sampleDate": yesterday, "individualWeights": [1200, 1250, 1180, 1300, 1220],
            })
            self.call("GET", b + "/weighings")
            self.call("GET", b + "/performance")

        self.section("Élevage — ponte")
        unit = None
        if layer or broiler:
            payload, _ = self.call("POST", f + "/production-units", {
                "name": "Poulailler A", "breedId": layer or broiler, "unitKind": "BATCH",
                "initialCount": 800, "startDate": yesterday,
            })
            unit = self.identifier(payload)
        self.call("GET", f + "/production-units")
        if unit:
            self.call("GET", f + f"/production-units/{unit}")
            self.call("POST", f + f"/production-units/{unit}/mortality", {"count": 2, "reason": "Chaleur"})
            self.call("GET", f + f"/production-units/{unit}/events")
        for path in ["/config/timeslots", "/config/grades", "/config/tray-settings", "/tray-stock"]:
            self.call("GET", f + "/egg-production" + path)
        if unit:
            self.call("GET", f + f"/egg-production/daily-production?unitId={unit}")
            self.call("GET", f + f"/egg-production/collections?unitId={unit}")

        self.section("Sanitaire")
        payload, _ = self.call("POST", f + "/health/veterinarians", {
            "fullName": "Dr Diop", "phone": "+221770000000", "speciality": "Aviaire",
        })
        vet = self.identifier(payload)
        for path in ["/veterinarians", "/alerts", "/catalog/vaccines", "/catalog/treatments",
                     "/catalog/programs", "/vet-visits/upcoming-follow-ups"]:
            self.call("GET", f + "/health" + path)
        if unit:
            for path in ["/observations", "/vaccinations", "/treatments", "/vet-visits",
                         "/treatments/active-withdrawals"]:
                self.call("GET", f + "/health" + path + f"?unitId={unit}")
            if vet:
                self.call("POST", f + "/health/vet-visits", {
                    "unitId": unit, "veterinarianId": vet, "visitDate": today,
                    "reason": "Contrôle", "costXof": 15000, "followUpNeeded": False,
                })

        self.section("Stock")
        payload, _ = self.call("POST", f + "/inventory/suppliers", {
            "commercialName": "Provendier Parcours", "phone": "+221771111111", "city": "Thiès",
        })
        supplier = self.identifier(payload)
        payload, _ = self.call("GET", f + "/inventory/catalog/articles/all")
        articles = self.unwrap(payload) or []
        article = articles[0].get("articleKey") if articles else None
        source = articles[0].get("articleSource", "INVENTORY") if articles else "INVENTORY"
        for path in ["/suppliers", "/stock-items", "/stock-items/low-stock", "/stock-items/valuation",
                     "/alerts", "/feed-formulas", "/catalog/feed-formulas", "/purchase-orders",
                     "/catalog/articles"]:
            self.call("GET", f + "/inventory" + path)
        if supplier and article:
            payload, _ = self.call("POST", f + "/inventory/purchase-orders", {
                "supplierId": supplier, "orderDate": today,
                "lines": [{"articleKey": article, "articleSource": source,
                           "orderedQuantity": 100, "unitPriceXof": 450}],
            })
            order = self.identifier(payload)
            if order:
                self.call("POST", f + f"/inventory/purchase-orders/{order}/submit", {})

        self.section("Commerce")
        payload, _ = self.call("POST", f + "/commercial/clients", {
            "clientType": "INDIVIDUAL", "displayName": "Client Parcours",
            "phone": "+221772222222", "creditLimitXof": 500000,
        })
        client = self.identifier(payload)
        for path in ["/clients", "/clients/over-credit-limit", "/sales", "/orders",
                     "/deliveries", "/invoices", "/invoices/overdue", "/payments"]:
            self.call("GET", f + "/commercial" + path)
        if client:
            self.call("GET", f + f"/commercial/clients/{client}/credit")
        self.call("GET", f + "/price-lists")

        self.section("Finance")
        for path in ["/summary", "/analytics", "/expenses", "/salaries", "/salary-settings", "/advances"]:
            self.call("GET", f + "/finance" + path)
        payload, _ = self.call("GET", f + "/catalog/expense_categories")
        categories = self.unwrap(payload) or []
        if categories and isinstance(categories[0], dict) and categories[0].get("key"):
            self.call("POST", f + "/finance/expenses", {
                "categoryKey": categories[0]["key"], "amountXof": 25000,
                "expenseDate": today, "label": "Achat parcours",
            })
        self.call("GET", f + "/finance/summary", note="compte de résultat après dépense")

        self.section("Notifications, assistant, clôture")
        self.call("POST", f + "/notifications/scan", {}, expect=(200, 201, 202, 204))
        self.call("GET", f + "/notifications")
        self.call("POST", f + "/notifications/read-all", {}, expect=(200, 204))
        self.call("POST", f + "/assistant/interpret", {"text": "5 morts dans le poulailler A"})
        self.call("GET", f + "/closures")

        self.section("Isolation entre fermes")
        neighbour = f"voisin{stamp}@jawdi.test"
        self.call("POST", "/auth/signup", {"email": neighbour, "password": PASSWORD, "fullName": "Voisin"})
        payload, _ = self.call("POST", "/auth/login", {"email": neighbour, "password": PASSWORD})
        self.tokens["neighbour"] = self.unwrap(payload).get("accessToken")
        for path in [f, f + "/dashboard", f + "/finance/summary", f + "/commercial/clients",
                     f + "/production-units", f + "/users"]:
            self.call("GET", path, who="neighbour", expect=(403,), note="ferme d'autrui")

        self.section("Régressions déjà payées une fois")
        self.call("GET", "/breeds", expect=(400,), note="paramètre requis manquant : 400, pas 500")
        self.call("GET", f + "/health/observations", expect=(400,), note="unitId manquant : 400, pas 500")
        self.call("GET", "/il-n-existe-pas", expect=(404,), note="adresse inconnue : 404, pas 500")
        self.call("POST", f + "/users",
                  {"email": f"x{stamp}@jawdi.test", "fullName": "X", "role": "INEXISTANT"},
                  expect=(400,), note="enum invalide : 400, pas 500")
        for path in ["/partner/me", "/partner/network", "/partner/network/farms"]:
            self.call("GET", path, expect=(403,), note="jeton éleveur sur le portail partenaire")

        return self.report()

    def report(self) -> int:
        print(f"\n{self.count} appels rejoués, {len(self.failures)} divergence(s).")
        if self.failures:
            print("\nDivergences :")
            for failure in self.failures:
                print(f"  - {failure}")
            return 1
        print("Parcours conforme.")
        return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=DEFAULT_BASE)
    parser.add_argument("--verbose", action="store_true", help="print every call, not just failures")
    args = parser.parse_args()
    return Journey(args.base_url, args.verbose).run()


if __name__ == "__main__":
    sys.exit(main())
