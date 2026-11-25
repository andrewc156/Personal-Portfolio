import { LABEL_TEXT_PAD, labelAttachment, placeLabelBoxes } from '../../lib/viz/explorer/labels.ts';

// Must match the placard text rule in PlaceLabels.astro (family from --font-sans).
const LABEL_FONT = "600 11px 'IBM Plex Sans'";

export function wirePlaceLabels(root: HTMLElement): void {
  const checkbox = root.querySelector<HTMLInputElement>('[data-ex-place-labels]');
  const layer = root.querySelector<SVGSVGElement>('[data-ex-place-layer]');
  const status = root.querySelector<HTMLElement>('[data-ex-place-status]');
  if (!checkbox || !layer || !status) return;

  const groups = new Map(
    Array.from(layer.querySelectorAll<SVGGElement>('[data-place-id]'), (group) => [
      Number(group.dataset.placeId),
      group,
    ]),
  );
  const markers = new Map(
    Array.from(layer.querySelectorAll<SVGGElement>('[data-place-marker]'), (group) => [
      Number(group.dataset.placeMarker),
      group,
    ]),
  );
  const layout = () => {
    const { width, height } = layer.getBoundingClientRect();
    if (!width || !height) return;
    layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const candidates = Array.from(groups, ([id, group]) => ({
      id,
      priority: Number(group.dataset.priority),
      x: Number(group.dataset.x) * width,
      y: Number(group.dataset.y) * height,
      textWidth: group.querySelector('text')!.getComputedTextLength(),
    }));
    const boxes = new Map(placeLabelBoxes(candidates, width, height).map((box) => [box.id, box]));

    for (const { id, x, y } of candidates) {
      const group = groups.get(id)!;
      const marker = markers.get(id)!;
      const box = boxes.get(id);
      group.toggleAttribute('data-placed', !!box);
      marker.toggleAttribute('data-placed', !!box);
      if (!box) continue;
      const line = marker.querySelector('line')!;
      const dot = marker.querySelector('circle')!;
      const background = group.querySelector('rect')!;
      const text = group.querySelector('text')!;
      line.setAttribute('x1', String(x));
      line.setAttribute('y1', String(y));
      const tip = labelAttachment({ x, y }, box);
      line.setAttribute('x2', String(tip.x));
      line.setAttribute('y2', String(tip.y));
      dot.setAttribute('cx', String(x));
      dot.setAttribute('cy', String(y));
      background.setAttribute('x', String(box.left));
      background.setAttribute('y', String(box.top));
      background.setAttribute('width', String(box.width));
      background.setAttribute('height', String(box.height));
      text.setAttribute('x', String(box.left + LABEL_TEXT_PAD));
      text.setAttribute('y', String(box.top + box.height / 2));
    }
    const message = `${boxes.size} of ${groups.size} place labels shown. See the full list in About the data.`;
    if (status.textContent !== message) status.textContent = message;
  };

  const observer = new ResizeObserver(layout);
  // Placard widths are measured from the drawn text, so lay out again once the webfont is
  // in use. A font swap doesn't resize the layer, so the ResizeObserver won't catch it.
  const fonts = document.fonts as FontFaceSet | undefined;
  const relayout = () => {
    if (checkbox.checked) layout();
  };
  const fontsReady = () => {
    fonts?.load(LABEL_FONT).then(relayout, () => {});
    fonts?.ready.then(relayout, () => {});
  };
  fonts?.addEventListener('loadingdone', relayout);
  checkbox.checked = false;
  checkbox.addEventListener('change', () => {
    root.dataset.placeLabels = checkbox.checked ? 'on' : 'off';
    if (checkbox.checked) {
      layout();
      observer.observe(layer);
      fontsReady();
    } else {
      observer.disconnect();
      status.textContent = 'Place labels hidden.';
    }
  });
}
