// ==UserScript==
// @name         Readability Okuyucu Modu (ShadowDOM + Ayarlar + Tema + TOC Popup + Android Butonu)
// @namespace    http://tampermonkey.net/
// @version      1.8
// @description  Sayfayı yenilemeden okunabilir moda geçiş yapar, tema ve font ayarları kaydedilir (F2 ile aç/kapa veya mobil buton)
// @author       ...
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/readability/0.6.0/Readability.min.js
// ==/UserScript==

(function() {
    'use strict';

    let shadowHost;
    let currentSettings = {
        font: GM_getValue('readerFont', 'sans-serif'),
        size: GM_getValue('readerSize', '22px'),
        lineHeight: GM_getValue('readerLineHeight', '1.5'),
        theme: GM_getValue('readerTheme', 'light')
    };

    const themes = {
        light: { background: 'white', text: '#333', title: '#222', border: '#eee', tocBackground: '#f8f8f8', buttonBg: '#f1f1f1', buttonHover: '#e0e0e0' },
        sepya: { background: '#f4ecd8', text: '#5b4636', title: '#4d3b2a', border: '#d9c7a7', tocBackground: '#e8dcc0', buttonBg: '#e0d4b8', buttonHover: '#d0c4a8' },
        dark: { background: '#1e1e1e', text: '#e0e0e0', title: '#ffffff', border: '#444', tocBackground: '#2a2a2a', buttonBg: '#333', buttonHover: '#444' },
        black: { background: '#000000', text: '#e0e0e0', title: '#ffffff', border: '#333', tocBackground: '#1a1a1a', buttonBg: '#222', buttonHover: '#333' }
    };

    // Create floating toggle button for mobile
    function createToggleButton() {
        const toggleBtn = document.createElement('div');
        toggleBtn.id = 'reader-toggle-btn';
        toggleBtn.style.position = 'fixed';
        toggleBtn.style.bottom = '20px';
        toggleBtn.style.right = '20px';
        toggleBtn.style.width = '50px';
        toggleBtn.style.height = '50px';
        toggleBtn.style.borderRadius = '50%';
        toggleBtn.style.backgroundColor = '#4285f4';
        toggleBtn.style.color = 'white';
        toggleBtn.style.display = 'flex';
        toggleBtn.style.alignItems = 'center';
        toggleBtn.style.justifyContent = 'center';
        toggleBtn.style.zIndex = '999998';
        toggleBtn.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        toggleBtn.style.cursor = 'pointer';
        toggleBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 8h-14a1 1 0 0 0 -1 1v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1 -1v-2a1 1 0 0 0 -1 -1z" /><path d="M13 16h-7a1 1 0 0 0 -1 1v2a1 1 0 0 0 1 1h7a1 1 0 0 0 1 -1v-2a1 1 0 0 0 -1 -1z" /></svg>';
        
        toggleBtn.addEventListener('click', toggleReaderMode);
        document.body.appendChild(toggleBtn);
    }

    function generateTOC(shadow) {
        const content = shadow.getElementById('readability-page-1');
        const headings = content.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (!headings.length) return;

        let tocHtml = `<div class="toc-popup"><ul class="toc-list">`;
        headings.forEach((h, i) => {
            const id = `toc-heading-${i}`;
            h.id = id;
            const level = parseInt(h.tagName.substring(1));
            const indent = (level - 1) * 15;
            tocHtml += `<li class="toc-item"><a href="#${id}" class="toc-link">${h.textContent}</a></li>`;
        });
        tocHtml += `</ul></div>`;
        const settingsDiv = shadow.querySelector('.settings');
        settingsDiv.insertAdjacentHTML('beforeend', tocHtml);
    }

    function applySettings(shadow) {
        const theme = themes[currentSettings.theme];
        const container = shadow.querySelector('.readability-container');
        if (!container) return;

        container.style.fontFamily = currentSettings.font;
        container.style.fontSize = currentSettings.size;
        container.style.lineHeight = currentSettings.lineHeight;
        container.style.background = theme.background;
        container.style.color = theme.text;

        const scrollbarStyle = `
            .readability-container::-webkit-scrollbar {
                width: 15px;
                height: 15px;
            }
            .readability-container::-webkit-scrollbar-thumb {
                background-color: ${currentSettings.theme === 'light' ? '#c1c1c1' :
                                 currentSettings.theme === 'sepya' ? '#d9c7a7' :
                                 currentSettings.theme === 'dark' ? '#444' : '#333'};
                border-radius: 10px;
            }
            .readability-container::-webkit-scrollbar-track {
                background-color: ${currentSettings.theme === 'light' ? '#f1f1f1' :
                                  currentSettings.theme === 'sepya' ? '#f4ecd8' :
                                  currentSettings.theme === 'dark' ? '#2a2a2a' : '#1a1a1a'};
            }
        `;

        const oldStyle = shadow.getElementById('scrollbar-style');
        if (oldStyle) oldStyle.remove();

        const styleEl = document.createElement('style');
        styleEl.id = 'scrollbar-style';
        styleEl.textContent = scrollbarStyle;
        shadow.appendChild(styleEl);

        shadow.querySelectorAll('p, div, span, li, a').forEach(el => {
            el.style.color = theme.text;
        });

        shadow.querySelectorAll('input, select').forEach(el => {
            el.style.color = theme.text;
            el.style.background = theme.buttonBg;
            el.style.border = `1px solid ${theme.border}`;
        });

        const title = shadow.querySelector('.readability-title');
        if (title) {
            title.style.color = theme.title;
            title.style.borderBottom = `1px solid ${theme.border}`;
        }

        const tocPopup = shadow.querySelector('.toc-popup');
        if (tocPopup) {
            tocPopup.style.background = theme.tocBackground;
            tocPopup.style.border = `1px solid ${theme.border}`;
        }

        shadow.querySelectorAll('.toc-link').forEach(link => {
            link.style.color = theme.text;
        });

        const tocButton = shadow.querySelector('.toc-button');
        if (tocButton) {
            tocButton.style.background = theme.buttonBg;
            tocButton.style.color = theme.text;
            tocButton.style.border = `1px solid ${theme.border}`;
        }

        const backToTopBtn = shadow.querySelector('.back-to-top');
        if (backToTopBtn) {
            backToTopBtn.style.background = theme.buttonBg;
            backToTopBtn.style.color = theme.text;
            backToTopBtn.style.border = `1px solid ${theme.border}`;
        }

        shadow.querySelectorAll('label').forEach(label => {
            label.style.color = theme.text;
        });
    }

    function toggleReaderMode() {
        const old = document.getElementById('reader-host');
        if (old) {
            exitReaderMode();
            return;
        }

        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';

        const docClone = document.cloneNode(true);
        const reader = new Readability(docClone).parse();
        if (!reader) return alert('İçerik çıkarılamadı.');

        shadowHost = document.createElement('div');
        shadowHost.id = 'reader-host';
        shadowHost.style = 'position:fixed;inset:0;z-index:9999999;all:initial;';
        document.body.appendChild(shadowHost);
        const shadow = shadowHost.attachShadow({ mode: 'open' });

        const html = `
            <style>
                h1, h2, h3, h4, h5, h6, p, ul, figure {
                    margin: 20px 0;
                }
                img{width: 100%;border-radius: 10px;}
                *{box-sizing: border-box;margin: 0; padding: 0;}
                .readability-container { all: initial; position:fixed; inset:0; overflow:auto; font-family:${currentSettings.font}; font-size:${currentSettings.size}; line-height:${currentSettings.lineHeight}; background:${themes[currentSettings.theme].background}; color:${themes[currentSettings.theme].text}; padding:20px; box-sizing:border-box; z-index:99999999; }
                .readability-content { max-width:800px; margin:0 auto; position: relative; }
                .readability-title { font-size:28px; margin-bottom:20px; border-bottom:1px solid ${themes[currentSettings.theme].border}; padding-bottom:10px; color:${themes[currentSettings.theme].title}; }
                .settings {display: flex;gap: 10px;font-size: 14px;padding: 20px 0;border-radius: 5px;max-width: 800px;margin: 0 auto; position: relative;}
                .toc-button {font-size: 18px;margin-left: auto;padding: 5px 10px;border: none;border-radius: 4px;background: #f1f1f1;color: #333;cursor: pointer;display: flex;align-items: center;gap: 10px;}
                .toc-button:hover { background:${themes[currentSettings.theme].buttonHover}; }
                .toc-popup { position:absolute; top:100%; right:0; width:300px; max-height:70vh; overflow:auto; padding:15px; border-radius:5px; display:none; background:${themes[currentSettings.theme].tocBackground}; border:1px solid ${themes[currentSettings.theme].border}; box-shadow:0 4px 8px rgba(0,0,0,0.2); z-index:100000000; }
                .toc-popup.visible { display:block; }
                .toc-title { font-size:18px; margin-bottom:10px; }
                .toc-list { list-style:none; padding:0; margin:0; display: flex; flex-direction: column; gap: 7px; }
                .toc-link { text-decoration:none; color:${themes[currentSettings.theme].text}; display:block; }
                .toc-link:hover { text-decoration:underline; }

                .settings select, .settings input {
                    font-size: 18px;
                    padding: 5px;
                    border-radius: 4px;
                    outline: none;
                    cursor: pointer;
                }

                .settings span {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .back-to-top {
                    bottom: 30px;
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    background: #333;
                    color: #e0e0e0;
                    border: 1px solid #444;
                    display: none;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    z-index: 100000001;
                    transition: all 0.3s;
                    position: sticky;
                    margin-left: -85px;
                }
                .back-to-top:hover {
                    background: ${themes[currentSettings.theme].buttonHover};
                }
                .back-to-top.visible {
                    display: flex;
                }
            </style>
            <div class="readability-container">
                <div class="settings">
                    <span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-typography"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 20l3 0" /><path d="M14 20l7 0" /><path d="M6.9 15l6.9 0" /><path d="M10.2 6.3l5.8 13.7" /><path d="M5 20l6 -16l2 0l7 16" /></svg> <select id="fontSelect"><option value="sans-serif">Sans-serif</option><option value="serif">Serif</option><option value="monospace">Monospace</option></select></span>
                    <span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-text-size"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 7v-2h13v2" /><path d="M10 5v14" /><path d="M12 19h-4" /><path d="M15 13v-1h6v1" /><path d="M18 12v7" /><path d="M17 19h2" /></svg> <select id="sizeSelect"><option value="18px">18px</option><option value="20px">20px</option><option value="22px">22px</option><option value="24px">24px</option></select></span>
                    <span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-line-height"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M3 8l3 -3l3 3" /><path d="M3 16l3 3l3 -3" /><path d="M6 5l0 14" /><path d="M13 6l7 0" /><path d="M13 12l7 0" /><path d="M13 18l7 0" /></svg> <select id="lineHeightSelect"><option value="1.0">1.0</option><option value="1.3">1.3</option><option value="1.5">1.5</option><option value="1.7">1.7</option></select></span>
                    <span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-paint"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 3m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v2a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z" /><path d="M19 6h1a2 2 0 0 1 2 2a5 5 0 0 1 -5 5l-5 0v2" /><path d="M10 15m0 1a1 1 0 0 1 1 -1h2a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-2a1 1 0 0 1 -1 -1z" /></svg> <select id="themeSelect"><option value="light">Light</option><option value="sepya">Sepya</option><option value="dark">Dark</option><option value="black">Black</option></select></span>
                    <button class="toc-button"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-list"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l11 0" /><path d="M9 12l11 0" /><path d="M9 18l11 0" /><path d="M5 6l0 .01" /><path d="M5 12l0 .01" /><path d="M5 18l0 .01" /></svg>İçindekiler</button>
                </div>
                <div id="readability-page-1" class="readability-content">
                    <h1 class="readability-title">${reader.title}</h1>
                    ${reader.byline ? `<div class="readability-byline">${reader.byline}</div>` : ''}
                    <div class="readability-content-body">${reader.content}</div>
                <button class="back-to-top" title="Yukarı Çık"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon icon-tabler icons-tabler-outline icon-tabler-arrow-bar-to-up"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 10l0 10" /><path d="M12 10l4 4" /><path d="M12 10l-4 4" /><path d="M4 4l16 0" /></svg></button>
                </div>
            </div>
        `;
        shadow.innerHTML = html;

        generateTOC(shadow);
        applySettings(shadow);

        const $ = id => shadow.getElementById(id);
        const update = () => {
            currentSettings = {
                font: $('fontSelect').value,
                size: $('sizeSelect').value,
                lineHeight: $('lineHeightSelect').value,
                theme: $('themeSelect').value
            };
            GM_setValue('readerFont', currentSettings.font);
            GM_setValue('readerSize', currentSettings.size);
            GM_setValue('readerLineHeight', currentSettings.lineHeight);
            GM_setValue('readerTheme', currentSettings.theme);
            applySettings(shadow);
        };

        $('fontSelect').value = currentSettings.font;
        $('sizeSelect').value = currentSettings.size;
        $('lineHeightSelect').value = currentSettings.lineHeight;
        $('themeSelect').value = currentSettings.theme;
        ['fontSelect', 'sizeSelect', 'lineHeightSelect', 'themeSelect'].forEach(id => $(id).addEventListener('change', update));

        const tocButton = shadow.querySelector('.toc-button');
        const tocPopup = shadow.querySelector('.toc-popup');
        if (tocButton && tocPopup) {
            tocButton.addEventListener('click', (e) => {
                e.stopPropagation();
                tocPopup.classList.toggle('visible');
            });
            shadow.addEventListener('click', e => {
                if (!e.target.closest('.toc-popup') && !e.target.closest('.toc-button')) {
                    tocPopup.classList.remove('visible');
                }
            });
        }

        shadow.querySelectorAll('.toc-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const id = link.getAttribute('href').substring(1);
                const target = shadow.getElementById(id);
                if (target) {
                    tocPopup.classList.remove('visible');
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    target.style.transition = 'background 0.5s';
                    target.style.backgroundColor = 'rgba(255,255,0,0.3)';
                    setTimeout(() => target.style.backgroundColor = '', 1500);
                }
            });
        });

        const backToTopBtn = shadow.querySelector('.back-to-top');
        const container = shadow.querySelector('.readability-container');

        backToTopBtn.addEventListener('click', () => {
            container.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });

        container.addEventListener('scroll', () => {
            if (container.scrollTop > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        });
    }

    function exitReaderMode() {
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        const readerHost = document.getElementById('reader-host');
        if (readerHost) {
            readerHost.remove();
        }
    }

    // Create toggle button when page loads
    createToggleButton();

    // Keyboard shortcut (F2)
    window.addEventListener('keydown', e => {
        if (e.key === 'F2') {
            const readerHost = document.getElementById('reader-host');
            if (readerHost) {
                exitReaderMode();
            } else {
                toggleReaderMode();
            }
        }
    });
})();