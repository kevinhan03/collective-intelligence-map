export const PLACE_LABEL_MIN_ZOOM = 12;

export type LabelRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type LabelCandidate = {
  id: string;
  selected: boolean;
  rect: LabelRect;
  pinRect?: LabelRect;
};

// A spatial grid avoids comparing every label with every pin on dense maps.
class OccupiedAreas {
  private cells = new Map<string, LabelRect[]>();

  private keys(rect: LabelRect) {
    const keys: string[] = [];
    for (
      let x = Math.floor(rect.left / 64);
      x <= Math.floor(rect.right / 64);
      x++
    )
      for (
        let y = Math.floor(rect.top / 64);
        y <= Math.floor(rect.bottom / 64);
        y++
      )
        keys.push(`${x}:${y}`);
    return keys;
  }

  add(rect: LabelRect) {
    for (const key of this.keys(rect)) {
      const cell = this.cells.get(key) ?? [];
      cell.push(rect);
      this.cells.set(key, cell);
    }
  }

  overlaps(rect: LabelRect, ownPin?: LabelRect) {
    return this.keys(rect).some((key) =>
      this.cells
        .get(key)
        ?.some(
          (other) =>
          other !== ownPin &&
          rect.left < other.right &&
            rect.right > other.left &&
            rect.top < other.bottom &&
            rect.bottom > other.top,
        ),
    );
  }
}

export function visibleMarkerLabels(
  candidates: LabelCandidate[],
  pins: LabelRect[],
): Set<string> {
  const occupied = new OccupiedAreas();
  pins.forEach((rect) => occupied.add(rect));
  const visible = new Set<string>();
  const ordered = candidates.toSorted(
    (a, b) =>
      Number(b.selected) - Number(a.selected) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const candidate of ordered) {
    // Reserve a little breathing room for the white text halo.
    const rect = {
      left: candidate.rect.left - 2,
      top: candidate.rect.top - 2,
      right: candidate.rect.right + 2,
      bottom: candidate.rect.bottom + 2,
    };
    if (candidate.selected || !occupied.overlaps(rect, candidate.pinRect)) {
      visible.add(candidate.id);
      occupied.add(rect);
    }
  }
  return visible;
}
