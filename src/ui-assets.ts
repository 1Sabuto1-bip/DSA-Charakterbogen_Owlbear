export interface UIAssetDefinition {
  url: string;
  role: "icon" | "decoration" | "background";
  sourceUrl?: string;
}

export const UI_ASSETS = {
  info: {
    url: new URL("./assets/info-icon.png", import.meta.url).href,
    role: "icon",
    sourceUrl: "https://cdn-icons-png.flaticon.com/512/61/61093.png",
  },
} satisfies Record<string, UIAssetDefinition>;

export const renderInfoIcon = (): string =>
  `<img class="ui-info-icon" src="${UI_ASSETS.info.url}" alt="" aria-hidden="true" />`;
