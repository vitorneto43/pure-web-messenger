// IDs de posts promocionais da conta oficial que devem ser ocultados dos feeds.
// Usado para remover a vitrine do novo layout sem deletar o conteúdo do banco.
export const HIDDEN_PROMO_POST_IDS = new Set([
  "8c5b6135-8fdc-4fc0-8bff-7a0883620627", // post "Já conhece a WaveChat?" com grid de recursos
  "66bf4096-f5a6-4c50-982f-95f1a43c6c8b", // imagem promocional do novo layout
]);

export function isPromoPost(postId: string): boolean {
  return HIDDEN_PROMO_POST_IDS.has(postId);
}
