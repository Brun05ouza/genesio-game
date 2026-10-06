// Carregador de imagens compartilhado pelas fases: tenta de novo se a rede falhar e informa o progresso (para a tela de carregamento).
const Loader = (() => {
  let requested = 0, done = 0;
  const api = {
    onProgress: null,
    reset() { requested = 0; done = 0; if (api.onProgress) api.onProgress(0, 0); },
    progress: () => ({ done, total: requested }),
    // carrega uma imagem; em caso de erro tenta até 3 vezes (a 2ª e a 3ª com um parâmetro para driblar um cache ruim)
    img(src, tries = 3) {
      requested++;
      return new Promise((res, rej) => {
        let n = 0;
        const finish = () => { done++; if (api.onProgress) api.onProgress(done, requested); };
        const go = () => {
          const i = new Image();
          i.onload = () => { finish(); res(i); };
          i.onerror = () => {
            if (++n < tries) setTimeout(go, 350 * n);
            else { finish(); rej(new Error('Não foi possível carregar: ' + src)); }
          };
          i.src = n ? src + (src.includes('?') ? '&' : '?') + 'r=' + n : src;
        };
        go();
      });
    },
  };
  return api;
})();
