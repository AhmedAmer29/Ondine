/** Matches TitleBar's fixed height exactly — every renderer that pins its canvas below the title bar imports this instead of hardcoding the number, so the two can never drift out of sync. */
export const TITLE_BAR_HEIGHT_PX = 44;
