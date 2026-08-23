import { BOOK_SLIM_BOX_OPTIONS, STANDARD_COURIER_BOX_OPTIONS, type BoxOption } from '../constants/boxOptions';

type GetQty = (id: string) => number;

/**
 * 선택 도서 조합에 맞는 최소 부피 박스 탐색 (0°/90° 풋프린트 + 레이어 높이 + 중량 적합성).
 * 산식은 admin/outbound 페이지 useMemo 원본 그대로 - 페이지 분해 시 순수 함수로만 이동.
 */
export function computeBestBox(selectedBooks: any[], getQty: GetQty, cushion: { thick_mm?: number; mode?: string } | null): BoxOption {
    if (selectedBooks.length === 0) return BOOK_SLIM_BOX_OPTIONS[0];

    let rawBooksTotalH = 0, totalQty = 0, totalWeightG = 0;
    let maxBookLongest = 0;
    let maxBookShortest = 0;

    selectedBooks.forEach(b => {
      const qty = getQty(b.id);
      const w = b.width_mm || b.width || 185;
      const d = b.depth_mm || b.depth || 257;
      maxBookLongest = Math.max(maxBookLongest, Math.max(w, d));
      maxBookShortest = Math.max(maxBookShortest, Math.min(w, d));
      rawBooksTotalH += (b.thickness_mm || b.height || 20) * qty;
      totalWeightG += (b.weight_g || 650) * qty;
      totalQty += qty;
    });

    const totalWeightKg = totalWeightG / 1000.0;
    const activeCushThick = (cushion?.thick_mm !== undefined) ? cushion!.thick_mm : 9.0;
    const activeCushMode = cushion?.mode || 'top';
    const zCushThick = (activeCushMode === 'top' || activeCushMode === 'both') ? activeCushThick : 0.0;
    const sideCushThick = (activeCushMode === 'side' || activeCushMode === 'both') ? activeCushThick : 0.0;

    const reqMaxW = maxBookLongest + (2 * sideCushThick);
    const reqMaxD = maxBookShortest + (2 * sideCushThick);

    const getGridHeightForBox = (bxW: number, bxD: number) => {
      const inW = Math.max(10, bxW - 2 * sideCushThick);
      const inD = Math.max(10, bxD - 2 * sideCushThick);
      const cap0 = Math.max(1, Math.floor(inW / Math.max(1, maxBookShortest))) * Math.max(1, Math.floor(inD / Math.max(1, maxBookLongest)));
      const cap90 = Math.max(1, Math.floor(inW / Math.max(1, maxBookLongest))) * Math.max(1, Math.floor(inD / Math.max(1, maxBookShortest)));
      const maxPerLayer = Math.max(1, Math.max(cap0, cap90));
      const layers = Math.ceil(totalQty / maxPerLayer);
      const avgThick = totalQty > 0 ? rawBooksTotalH / totalQty : 20;
      return layers * avgThick;
    };

    const allBoxesSortedByVolume = [...BOOK_SLIM_BOX_OPTIONS, ...STANDARD_COURIER_BOX_OPTIONS].sort((a, b) => {
      const dA = a.specs.match(/(\d+)x(\d+)x(\d+)/);
      const dB = b.specs.match(/(\d+)x(\d+)x(\d+)/);
      const rawVolA = dA ? parseInt(dA[1]) * parseInt(dA[2]) * parseInt(dA[3]) : 0;
      const rawVolB = dB ? parseInt(dB[1]) * parseInt(dB[2]) * parseInt(dB[3]) : 0;
      const isSlimA = BOOK_SLIM_BOX_OPTIONS.some(bx => bx.id === a.id);
      const isSlimB = BOOK_SLIM_BOX_OPTIONS.some(bx => bx.id === b.id);
      const effVolA = isSlimA ? rawVolA * 0.85 : rawVolA;
      const effVolB = isSlimB ? rawVolB * 0.85 : rawVolB;
      return effVolA - effVolB;
    });

    for (const bx of allBoxesSortedByVolume) {
      const d = bx.specs.match(/(\d+)x(\d+)x(\d+)/);
      if (!d) continue;
      const bw = parseInt(d[1]), bd = parseInt(d[2]), bh = parseInt(d[3]);

      // Strict Footprint Fit Test for both 0° and 90° orientation
      const isFootprintFit = (Math.max(bw, bd) >= reqMaxW) && (Math.min(bw, bd) >= reqMaxD);
      if (!isFootprintFit) continue;

      const reqH = getGridHeightForBox(bw, bd) + zCushThick;
      const isHeightFit = bh >= reqH;
      if (!isHeightFit) continue;

      const isWeightFit = totalWeightKg <= bx.maxWeight_kg;
      if (!isWeightFit) continue;

      // Absolute smallest 3D volume box found among all 16 options!
      return bx;
    }

    return BOOK_SLIM_BOX_OPTIONS[BOOK_SLIM_BOX_OPTIONS.length - 1];
  }

/** 박스·도서 조합에서 Z/XY 여유를 만족하는 완충재 이름 추천. */
export function recommendCushionName(bestBox: BoxOption, selectedBooks: any[], getQty: GetQty): string {
    let maxW = 0, maxD = 0, booksTotalH = 0;
    selectedBooks.forEach(b => {
      const qty = getQty(b.id);
      const rawW = b.width_mm || b.width || 185;
      const rawD = b.depth_mm || b.depth || 257;
      maxW = Math.max(maxW, Math.max(rawW, rawD));
      maxD = Math.max(maxD, Math.min(rawW, rawD));
      booksTotalH += (b.thickness_mm || b.height || 20) * qty;
    });

    const boxDim = bestBox.specs.match(/(\d+)x(\d+)x(\d+)/);
    const boxW = boxDim ? parseInt(boxDim[1]) : 250;
    const boxD = boxDim ? parseInt(boxDim[2]) : 150;
    const boxH = boxDim ? parseInt(boxDim[3]) : 60;
    const bMax = Math.max(boxW, boxD);
    const bMin = Math.min(boxW, boxD);

    // 8 Cushions with mode and sideThick & protection score
    const cushions = [
      { name: "3D 폼 블록 코너 캡 (30mm)", mode: "side", thick_mm: 30.0 },
      { name: "에어튜브 3D범퍼 (20mm)", mode: "both", thick_mm: 20.0 },
      { name: "코너 에어 범퍼 가드 (15mm)", mode: "side", thick_mm: 15.0 },
      { name: "PE폼 4면가드 (측면둘기 25mm)", mode: "side", thick_mm: 25.0 },
      { name: "벌집종이 (12mm)", mode: "both", thick_mm: 12.0 },
      { name: "크라프트 종이 4면 패킹 (10mm)", mode: "side", thick_mm: 10.0 },
      { name: "뽁뽁이 상단채움 (25mm)", mode: "top", thick_mm: 25.0 },
      { name: "에어필로우 (9mm)", mode: "top", thick_mm: 9.0 }
    ];
    
    const valid = cushions.filter(c => {
      const zThick = (c.mode === 'top' || c.mode === 'both') ? c.thick_mm : 0.0;
      const isZValid = booksTotalH + zThick <= boxH;

      const sideThick = (c.mode === 'side' || c.mode === 'both') ? c.thick_mm : 0.0;
      const isXYValid = (maxW + 2 * sideThick <= bMax) && (maxD + 2 * sideThick <= bMin);

      return isZValid && isXYValid;
    });

    if (valid.length > 0) return valid[0].name;
    return "에어필로우 (9mm)";
  }
