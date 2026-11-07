/**
 * The reference ("Cible") dashed line must come from the server's `expectedCurve` points,
 * smoothed the same way the real weighing curve is — never a client-side straight line from
 * (0,0) to a single target. A straight line over-demands roughly double the real weight in the
 * first fortnight for a slow-growing breed; the backend's score was fixed for this on 2026-09-05,
 * but the chart wasn't, until now. An empty `expectedCurve` (rustic/local breeds, no target) must
 * draw no reference at all, exactly as the server chose to send nothing.
 */
import { render } from '@testing-library/react-native';
import { GrowthChart, type GrowthPoint } from '../GrowthChart';

const data: GrowthPoint[] = [
  { age: 0, weightG: 100 },
  { age: 10, weightG: 400 },
  { age: 20, weightG: 900 },
];

/** Every rendered node whose own props carry a dashed stroke (the reference line only). */
async function dashedPaths(expectedCurve: GrowthPoint[]) {
  const { container } = await render(<GrowthChart data={data} expectedCurve={expectedCurve} />);
  return container.queryAll((i) => i.props.strokeDasharray != null);
}

describe('GrowthChart — référence servie par le serveur', () => {
  it('ne trace aucun pointillé quand la courbe attendue est vide', async () => {
    expect(await dashedPaths([])).toHaveLength(0);
  });

  it('trace le pointillé à partir des points reçus, pas une droite interpolée vers un seul point', async () => {
    const expectedCurve: GrowthPoint[] = [
      { age: 0, weightG: 50 },
      { age: 10, weightG: 300 },
      { age: 20, weightG: 950 },
    ];
    const dashed = await dashedPaths(expectedCurve);
    expect(dashed).toHaveLength(1);
    // A straight line from (0,0) to a single target is one `M...L...` segment — no cubic `C`
    // command at all. Three received points, smoothed the same way the real curve is, produce
    // TWO cubic ("C") segments: proof the path is built from the server's own points, not a
    // 2-point line this client invented.
    const cubicSegments = (dashed[0]!.props.d as string).split('C').length - 1;
    expect(cubicSegments).toBe(2);
  });

  it("trie l'expectedCurve par âge avant de tracer (le serveur ne garantit pas l'ordre)", async () => {
    const expectedCurve: GrowthPoint[] = [
      { age: 20, weightG: 950 },
      { age: 0, weightG: 50 },
      { age: 10, weightG: 300 },
    ];
    const dashed = await dashedPaths(expectedCurve);
    expect(dashed).toHaveLength(1);
    const d = dashed[0]!.props.d as string;
    const firstX = Number(d.match(/^M([\d.]+),/)![1]);
    // age 0 maps near the chart's left edge; age 20 (first in this deliberately unsorted input)
    // would map near the right edge if the path were drawn in received order instead of by age.
    expect(firstX).toBeLessThan(50);
  });
});
