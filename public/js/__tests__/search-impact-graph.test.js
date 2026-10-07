const { calculateImpactBars } = require('../search-impact-graph');

describe('calculateImpactBars', () => {
    it('returns null when the impact map is empty', () => {
        expect(calculateImpactBars({}, 2020, 2022)).toBeNull();
    });

    it('returns null when every value is zero or missing', () => {
        const impact = { 2020: 0, 2021: 0 };
        expect(calculateImpactBars({ impact }, 2020, 2022)).toBeNull();
    });

    it('returns one entry per year in the inclusive range', () => {
        const impact = { 2020: 1 };
        const bars = calculateImpactBars({ impact }, 2020, 2023);

        expect(bars).toHaveLength(4);
        expect(bars.map((bar) => bar.year)).toEqual([2020, 2021, 2022, 2023]);
    });

    it('computes each year percentage as its share of the total', () => {
        const impact = { 2020: 1, 2021: 1, 2022: 2 };
        const bars = calculateImpactBars({ impact }, 2020, 2022);

        expect(bars[0].percentage).toBeCloseTo(0.25);
        expect(bars[1].percentage).toBeCloseTo(0.25);
        expect(bars[2].percentage).toBeCloseTo(0.5);
    });

    it('defaults years missing from the impact map to zero', () => {
        const impact = { 2020: 1 };
        const bars = calculateImpactBars({ impact }, 2020, 2021);

        expect(bars[1].value).toBe(0);
        expect(bars[1].isZero).toBe(true);
    });

    it('coerces non-numeric values to zero instead of throwing', () => {
        const impact = { 2020: 'not-a-number', 2021: null, 2022: 3 };
        const bars = calculateImpactBars({ impact }, 2020, 2022);

        expect(bars[0].value).toBe(0);
        expect(bars[1].value).toBe(0);
        expect(bars[2].value).toBe(3);
    });

    it('flags zero-value years so no bar is rendered for them', () => {
        const impact = { 2020: 5, 2021: 0 };
        const bars = calculateImpactBars({ impact }, 2020, 2021);

        expect(bars[0].isZero).toBe(false);
        expect(bars[1].isZero).toBe(true);
        expect(bars[1].heightPercent).toBe(0);
        expect(bars[1].percentageText).toBeNull();
    });

    it('scales the tallest bar to 100% of the available height', () => {
        const impact = { 2020: 1, 2021: 4 };
        const bars = calculateImpactBars({ impact }, 2020, 2021);

        expect(bars[1].heightPercent).toBeCloseTo(100);
        expect(bars[0].heightPercent).toBeCloseTo(25);
    });

    it('formats the percentage with two decimals', () => {
        const impact = { 2020: 1, 2021: 3 };
        const bars = calculateImpactBars({ impact }, 2020, 2021);

        expect(bars[0].percentageText).toBe('25.00%');
        expect(bars[1].percentageText).toBe('75.00%');
    });

    it('returns null when the timeline itself is missing', () => {
        expect(calculateImpactBars(undefined, 2020, 2022)).toBeNull();
    });

    it('exposes the number of matching documents of each year', () => {
        const timeline = { impact: { 2020: 0.1, 2021: 0.3 }, counts: { 2020: 120, 2021: '8634' } };
        const bars = calculateImpactBars(timeline, 2020, 2021);

        expect(bars[0].count).toBe(120);
        expect(bars[1].count).toBe(8634);
    });

    it('defaults the count to zero when counts are missing', () => {
        const bars = calculateImpactBars({ impact: { 2020: 1 } }, 2020, 2020);

        expect(bars[0].count).toBe(0);
    });
});
