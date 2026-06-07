# BG/Text Color Inspector

Extensão do Google Chrome que exibe classes de cor Tailwind (`bg-*` e `text-*`) ao passar o mouse sobre os elementos da página.

## Instalação

1. Abra `chrome://extensions`
2. Ative **Modo do desenvolvedor**
3. Clique em **Carregar sem compactação**
4. Selecione esta pasta

## Uso

1. Acesse qualquer página
2. Clique no ícone da extensão para ativar (badge **ON**)
3. Passe o mouse sobre os elementos para ver as classes de cor
4. Clique novamente no ícone para desativar

## O que é exibido

- Cores da paleta Tailwind (`bg-red-500`, `text-white`, etc.)
- Opacidade (`text-red-500/50`)
- Valores arbitrários de cor (`bg-[#fff]`, `text-[var(--primary)]`)
- Tokens semânticos customizados (`bg-primary`, `text-foreground`)

## O que é ignorado

- Tamanhos de fonte (`text-sm`, `text-sm/4`, `text-[14px]`)
- Utilitários de layout (`text-center`, `text-ellipsis`, `bg-cover`, etc.)
