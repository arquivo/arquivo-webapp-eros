/** @jest-environment jsdom */
const { describeScript } = require('./helpers/load-script.cjs');

// annotate.js adds a relevance annotation mode to both search results pages, turned on
// with ?annotate=true. The markup below is trimmed from the views it runs on.

// views/templates/header/header-pages-search-results.ejs (search bar, date slider inputs)
// and views/templates/fragments/search-tools-buttons.ejs.
const SEARCH_TOOLS = `
<form id="search-form" action="/page/search" method="GET">
  <input id="submit-search-input" type="search" name="q" value="sapo">
  <input type="hidden" name="from" id="start-date" value="19960101">
  <input type="hidden" name="to" id="end-date" value="20201231">
</form>
<section id="search-tools-buttons">
  <h4>Search tools</h4>
  <form id="search-form-pages" class="search-type buttons" action="/page/search" method="get"><button type="submit" value="Pages">Pages</button></form>
  <form id="search-form-images" class="search-type buttons" action="/image/search" method="get"><button type="submit" value="Images">Images</button></form>
  <button id="search-tools-narrative-button" class="buttons">Narrative</button>
  <form id="search-form-advanced" class="search-type buttons" action="/page/advanced/search" method="get"><button type="submit">Advanced search</button></form>
</section>`;

// The annotations are stored per search: query, start date and end date.
const QUERY = 'sapo 19960101 20201231';

// views/templates/fragments/page-result.ejs
const pageResult = (index, url = `https://example.com/${index}`, tstamp = '20200102030405') => `
<ul class="page-search-result" data-index="${index}" data-tstamp="${tstamp}" data-url="${url}">
  <li><a href="/page/view/track_${index}/${tstamp}/${encodeURIComponent(url)}" class="overlay-link" aria-label="Result ${index}"></a></li>
  <li><a class="results-url blockUrl" title="${url}">${url}</a></li>
  <li><p class="results-date">2 janeiro 2020</p></li>
</ul>`;
const pageId = (index, url = `https://example.com/${index}`, tstamp = '20200102030405') =>
    `${tstamp}/${encodeURIComponent(url)}`;

// views/templates/body/body-pages-search-results.ejs, once the results partial has loaded.
const pagesResults = (count) =>
    `<section id="pages-results" class="pages-results-cl">${range(count).map((i) => pageResult(i)).join('')}</section>`;

// views/templates/fragments/image-result.ejs
const imageSrc = (index) => `https://arquivo.pt/noFrame/replay/20170624094538im_/http://example.com/${index}.jpg`;
const imageResult = (index) => `
<li class="image-card" id="image-card-${index}" data-index="${index}" data-tstamp="20170624094538" data-url="http://example.com/${index}.jpg">
  <form style="display: none;" id="search-result-form-${index}" action="/image/view/track_${index}/20170624094538/http%3A%2F%2Fexample.com%2F${index}.jpg"></form>
  <ul>
    <li><a href="#modal" rel="modal:open" class="zoom-image fas fa-search-plus" aria-hidden="true"></a></li>
    <li><a href="#modal" rel="modal:open" class="results-image"><img src="${imageSrc(index)}" title="Image ${index}" alt="Image ${index}"></a></li>
    <li><p class="results-date">24 junho 2017</p></li>
  </ul>
</li>`;

// views/partials/images-search-results.ejs
const imagesResults = (count) =>
    `<ul id="image-cards-container">${range(count).map((i) => imageResult(i)).join('')}</ul>`;

const range = (count) => Array.from({ length: count }, (_, i) => i + 1);

const GRAY = 'background-color: rgba(200,200,200) !important;';
const RED = 'background-color: rgba(255,0,0,0.4) !important;';
const YELLOW = 'background-color: rgba(255,255,0,0.4) !important;';
const GREEN = 'background-color: rgba(0,255,0,0.4) !important;';
const BLACK = 'background-color: rgba(0,0,0,0.8) !important;';

const $id = (id) => document.getElementById(id);
const stored = () => JSON.parse(localStorage.getItem('annotations'));
const storedResults = (type = 'page') => stored()[type].queries[QUERY].results;
const pageCards = () => Array.from(document.querySelectorAll('ul.page-search-result'));
const imageCards = () => Array.from(document.querySelectorAll('li.image-card'));
const relevanceButton = (card, label) => card.querySelector(`input[type=button][value="${label}"]`);
const press = (code) => document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));

describeScript('js/annotate.js', { html: SEARCH_TOOLS + pagesResults(3) }, ({ setup, whileParsing }) => {
    let hadScrollIntoView;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(console, 'log').mockImplementation(() => {});
        localStorage.clear();
        // jsdom does not lay out pages, so it has no scrollIntoView.
        hadScrollIntoView = 'scrollIntoView' in Element.prototype;
        if (!hadScrollIntoView) {
            Element.prototype.scrollIntoView = function () {};
        }
        jest.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
        jest.restoreAllMocks();
        if (!hadScrollIntoView) {
            delete Element.prototype.scrollIntoView;
        }
        localStorage.clear();
        history.replaceState(null, '', '/');
    });

    // Open `path` and run the script on `html`, then let its 500ms poll find the results.
    function open(path, html) {
        history.replaceState(null, '', path);
        const bindings = setup(html);
        jest.advanceTimersByTime(500);
        return bindings;
    }

    const addedTools = () => Array.from($id('search-tools-buttons').children).slice(-4);

    describe('annotation mode off', () => {
        it('leaves the page alone', () => {
            open('/page/search?q=sapo');

            expect(console.log).toHaveBeenCalledWith('ANNOTATE: false');
            expect(localStorage.getItem('annotate')).toBeNull();
            expect(localStorage.getItem('annotations')).toBeNull();
            expect($id('search-form-pages').style.display).toBe('');
            expect($id('clearAnnotationsButton')).toBeNull();
            expect($id('startend')).toBeNull();
            expect(document.querySelector('.ids')).toBeNull();

            jest.advanceTimersByTime(5000);
            expect(document.querySelector('.ids')).toBeNull();
        });

        it('ignores the keyboard', () => {
            localStorage.setItem('annotateKeyboard', 'true');
            open('/page/search?q=sapo');

            press('F1');
            press('KeyD');

            expect(localStorage.getItem('annotateKeyboard')).toBe('true');
            expect(pageCards()[1].style.borderWidth).toBe('');
        });

        it('stays off with ?annotate=false', () => {
            open('/page/search?q=sapo&annotate=false');

            expect(localStorage.getItem('annotate')).toBeNull();
            expect($id('clearAnnotationsButton')).toBeNull();
        });
    });

    describe('turning annotation mode on', () => {
        it('?annotate=true turns it on and remembers it', () => {
            open('/page/search?q=sapo&annotate=true');

            expect(console.log).toHaveBeenCalledWith('ANNOTATE: true');
            expect(localStorage.getItem('annotate')).toBe('true');
            expect($id('clearAnnotationsButton')).not.toBeNull();
        });

        it('stays on in later searches without the parameter', () => {
            localStorage.setItem('annotate', 'true');

            open('/page/search?q=sapo');

            expect($id('clearAnnotationsButton')).not.toBeNull();
        });

        it('hides the search type and narrative buttons', () => {
            open('/page/search?q=sapo&annotate=true');

            expect($id('search-form-pages').style.display).toBe('none');
            expect($id('search-form-images').style.display).toBe('none');
            expect($id('search-tools-narrative-button').style.display).toBe('none');
            expect($id('search-form-advanced').style.display).toBe('');
        });

        it('adds the clear, export and turn off buttons and the result range to the search tools', () => {
            open('/page/search?q=sapo&annotate=true');

            expect(addedTools().map((x) => x.outerHTML)).toEqual([
                '<a id="clearAnnotationsButton" style="margin-left:-7px" href="#" onclick="clearAnnotations()"><button>Limpar anotações</button></a>',
                '<a id="exportAnnotationsButton" style="margin-left: 5px;" href="#" onclick="exportAnnotations()"><button>Exportar anotações</button></a>',
                '<a id="turnOffAnnotationsButton" style="margin-left:5px" href="#" onclick="turnOffAnnotations()"><button>Desligar modo anotação</button></a>',
                '<p id="startend" style="margin-left: 60px; margin-top: 5px;"><span>1 até 10</span></p>',
            ]);
        });

        it.each([
            ['/page/search?q=sapo&annotate=true&offset=20', '21 até 30'],
            ['/page/search?q=sapo&annotate=true&offset=10&maxItems=50', '11 até 60'],
            ['/image/search?q=sapo&annotate=true', '1 até 24'],
            ['/image/search?q=sapo&annotate=true&offset=24&maxItems=12', '25 até 36'],
            ['/page/search?q=sapo&annotate=true&offset=x', 'NaN até NaN'],
        ])('shows the result range of %s as "%s"', (path, text) => {
            open(path, SEARCH_TOOLS);

            expect($id('startend').innerHTML).toBe(`<span>${text}</span>`);
        });

        it('keeps the api parameter in the search form', () => {
            open('/page/search?q=sapo&annotate=true&api=a"b<c>');

            const input = $id('search-form').lastElementChild;
            expect(input.tagName).toBe('INPUT');
            expect(input.getAttributeNames()).toEqual(['type', 'name', 'value']);
            expect([input.type, input.name, input.getAttribute('value')]).toEqual(['hidden', 'api', 'a"b<c>']);
            expect(document.querySelectorAll('input[name=api]')).toHaveLength(1);
        });

        it('adds no api input without the parameter', () => {
            open('/page/search?q=sapo&annotate=true');

            expect(document.querySelector('input[name=api]')).toBeNull();
        });

        it('copes with pages without the search tools buttons or the search form', () => {
            const html = `<input id="submit-search-input" value="sapo">
                <input id="start-date" value="19960101"><input id="end-date" value="20201231">${pagesResults(1)}`;

            open('/page/search?q=sapo&annotate=true&api=x', html);

            expect($id('startend')).toBeNull();
            expect(document.querySelector('input[name=api]')).toBeNull();
            expect(document.querySelectorAll('.ids')).toHaveLength(1);
        });
    });

    describe('on the page search results', () => {
        it('waits for the results to load, checking every 500ms', () => {
            open('/page/search?q=sapo&annotate=true', SEARCH_TOOLS + '<section id="pages-results"></section>');
            jest.advanceTimersByTime(1000);
            expect(document.querySelector('.ids')).toBeNull();

            $id('pages-results').innerHTML = pageResult(1) + pageResult(2);
            jest.advanceTimersByTime(499);
            expect(document.querySelector('.ids')).toBeNull();
            jest.advanceTimersByTime(1);
            expect(document.querySelectorAll('.ids')).toHaveLength(2);

            // It stops checking once it has found them.
            $id('pages-results').insertAdjacentHTML('beforeend', pageResult(3));
            jest.advanceTimersByTime(5000);
            expect(document.querySelectorAll('.ids')).toHaveLength(2);
            expect(pageCards()[2].querySelector('.ids')).toBeNull();
        });

        it('adds the relevance buttons and the result id to every result', () => {
            open('/page/search?q=sapo&annotate=true');

            pageCards().forEach((card, i) => {
                const added = card.lastElementChild;
                expect(added.tagName).toBe('DIV');
                const buttons = Array.from(added.querySelectorAll('input[type=button]'));
                expect(buttons.map((b) => [b.id, b.value, b.getAttribute('alt')])).toEqual([
                    [`${i + 1}Conteúdo inacessível`, 'Conteúdo inacessível', '-2'],
                    [`${i + 1}Não relevante`, 'Não relevante', '0'],
                    [`${i + 1}Parcialmente relevante`, 'Parcialmente relevante', '1'],
                    [`${i + 1}Muito relevante`, 'Muito relevante', '2'],
                ]);
                expect(buttons[0].style.backgroundColor).toBe('rgba(0, 0, 0, 0.8)');
                expect(buttons[3].style.color).toBe('black');
                const ids = added.lastElementChild;
                expect(ids.outerHTML).toBe(`<div id="${pageId(i + 1)}" class="ids"></div>`);
            });
        });

        it('makes room for the buttons below the result link', () => {
            open('/page/search?q=sapo&annotate=true');

            pageCards().forEach((card) => {
                expect(card.querySelector('a.overlay-link').getAttribute('style')).toBe('height:calc(100% - 100px)');
            });
        });

        it('stores every result as not annotated, with its URL, timestamp and position', () => {
            open('/page/search?q=sapo&annotate=true&offset=20');

            expect(stored()).toEqual({
                image: { queries: {} },
                page: {
                    queries: {
                        [QUERY]: {
                            results: Object.fromEntries(range(3).map((i) => [pageId(i), {
                                relevance: -1,
                                metadata: {
                                    url: encodeURIComponent(`https://example.com/${i}`),
                                    timestamp: '20200102030405',
                                    position: 20 + i,
                                },
                            }])),
                        },
                    },
                },
            });
            pageCards().forEach((card) => expect(card.getAttribute('style')).toBe(GRAY));
        });

        it('restores the annotations made before', () => {
            localStorage.setItem('annotations', JSON.stringify({
                image: { queries: {} },
                page: { queries: { [QUERY]: { results: {
                    [pageId(1)]: { relevance: 0, metadata: { kept: true } },
                    [pageId(3)]: { relevance: -2, metadata: {} },
                } } } },
            }));

            open('/page/search?q=sapo&annotate=true');

            expect(pageCards().map((card) => card.getAttribute('style'))).toEqual([RED, GRAY, BLACK]);
            expect(storedResults()[pageId(1)]).toEqual({ relevance: 0, metadata: { kept: true } });
            expect(storedResults()[pageId(2)].relevance).toBe(-1);
        });

        it('keeps the annotations of other searches', () => {
            const other = { results: { x: { relevance: 2, metadata: {} } } };
            localStorage.setItem('annotations', JSON.stringify({
                image: { queries: { other } },
                page: { queries: { other } },
            }));

            open('/page/search?q=sapo&annotate=true');

            expect(stored().image.queries).toEqual({ other });
            expect(stored().page.queries.other).toEqual(other);
            expect(Object.keys(storedResults())).toHaveLength(3);
        });

        it.each([
            ['Conteúdo inacessível', -2, BLACK],
            ['Não relevante', 0, RED],
            ['Parcialmente relevante', 1, YELLOW],
            ['Muito relevante', 2, GREEN],
        ])('clicking "%s" stores relevance %s and colours the result', (label, value, style) => {
            open('/page/search?q=sapo&annotate=true');
            const card = pageCards()[1];
            const onCardClick = jest.fn();
            card.addEventListener('click', onCardClick);

            const click = new MouseEvent('click', { bubbles: true, cancelable: true });
            relevanceButton(card, label).dispatchEvent(click);

            expect(click.defaultPrevented).toBe(true);
            expect(onCardClick).not.toHaveBeenCalled();
            expect(storedResults()[pageId(2)].relevance).toBe(value);
            expect(card.getAttribute('style')).toBe(style);
            expect(pageCards()[0].getAttribute('style')).toBe(GRAY);
            expect(storedResults()[pageId(1)].relevance).toBe(-1);
        });

        it('colours every copy of a result that is shown twice', () => {
            const html = SEARCH_TOOLS + `<section id="pages-results">${pageResult(1, 'https://example.com/same')}${pageResult(2, 'https://example.com/same')}${pageResult(3)}</section>`;
            open('/page/search?q=sapo&annotate=true', html);

            relevanceButton(pageCards()[0], 'Muito relevante').click();

            expect(pageCards().map((card) => card.getAttribute('style'))).toEqual([GREEN, GREEN, GRAY]);
            expect(storedResults()[pageId(1, 'https://example.com/same')].relevance).toBe(2);
        });
    });

    describe('on the image search results', () => {
        const html = SEARCH_TOOLS + imagesResults(3);

        it('adds the relevance buttons to every image, with the image address as its id', () => {
            open('/image/search?q=sapo&annotate=true', html);

            imageCards().forEach((card, i) => {
                const added = card.lastElementChild;
                expect(Array.from(added.querySelectorAll('input[type=button]'), (b) => b.id)).toEqual([
                    `${i + 1}Conteúdo inacessível`, `${i + 1}Não relevante`, `${i + 1}Parcialmente relevante`, `${i + 1}Muito relevante`,
                ]);
                expect(added.lastElementChild.id).toBe(imageSrc(i + 1));
                expect(card.getAttribute('style')).toBe(GRAY);
            });
        });

        it('stores the image URL and position, but no timestamp (it reads data-timestamp, the cards have data-tstamp)', () => {
            open('/image/search?q=sapo&annotate=true', html);

            expect(stored().page).toEqual({ queries: {} });
            expect(storedResults('image')).toEqual(Object.fromEntries(range(3).map((i) => [imageSrc(i), {
                relevance: -1,
                metadata: { url: `http://example.com/${i}.jpg`, position: i },
            }])));
        });

        it('clicking a relevance button stores it and colours the image', () => {
            open('/image/search?q=sapo&annotate=true', html);
            const card = imageCards()[2];

            relevanceButton(card, 'Parcialmente relevante').click();

            expect(storedResults('image')[imageSrc(3)].relevance).toBe(1);
            expect(card.getAttribute('style')).toBe(YELLOW);
            expect(imageCards()[0].getAttribute('style')).toBe(GRAY);
        });

        // The id comes from #image-card-<data-index + offset>, but the cards are numbered from 1
        // on every page: past the first page no card matches, and every image gets the id "undefined".
        it('past the first page, gives every image the same "undefined" id', () => {
            open('/image/search?q=sapo&annotate=true&offset=24', html);

            expect(Array.from(document.querySelectorAll('.ids'), (x) => x.id)).toEqual(['undefined', 'undefined', 'undefined']);
            expect(storedResults('image')).toEqual({
                undefined: { relevance: -1, metadata: { url: 'http://example.com/1.jpg', position: 25 } },
            });

            relevanceButton(imageCards()[0], 'Não relevante').click();
            expect(imageCards().map((card) => card.getAttribute('style'))).toEqual([RED, RED, RED]);
        });

        it('keeps the relevance buttons on images without a data-url', () => {
            open('/image/search?q=sapo&annotate=true', SEARCH_TOOLS + imagesResults(1).replace(/ data-url="[^"]*"/, ''));

            expect(storedResults('image')[imageSrc(1)].metadata).toEqual({ position: 1 });
        });

        // divResId is "image-cards-container" (no "#"), so the keyboard shortcuts find no images.
        it('the keyboard shortcuts that annotate every image do nothing', () => {
            localStorage.setItem('annotateKeyboard', 'true');
            open('/image/search?q=sapo&annotate=true', html);

            press('Digit1');

            expect(Object.values(storedResults('image')).map((x) => x.relevance)).toEqual([-1, -1, -1]);
        });
    });

    describe('keyboard', () => {
        const manyResults = SEARCH_TOOLS + pagesResults(12);
        const borders = () => pageCards().map((card) => card.style.borderWidth);

        beforeEach(() => {
            localStorage.setItem('annotateKeyboard', 'true');
        });

        it('F1 turns the keyboard shortcuts on and off', () => {
            localStorage.removeItem('annotateKeyboard');
            open('/page/search?q=sapo&annotate=true');

            press('KeyD');
            expect(borders()).toEqual(['', '', '']);

            press('F1');
            expect(localStorage.getItem('annotateKeyboard')).toBe('true');
            press('KeyD');
            expect(borders()).toEqual(['0px', '5px', '']);

            press('F1');
            expect(localStorage.getItem('annotateKeyboard')).toBe('false');
            press('KeyD');
            expect(borders()).toEqual(['0px', '5px', '']);
        });

        it('D and A select the next and the previous result, wrapping around', () => {
            open('/page/search?q=sapo&annotate=true');
            const cards = pageCards();

            press('KeyD');
            expect(borders()).toEqual(['0px', '5px', '']);
            expect(cards[1].style.borderColor).toBe('black');
            expect(Element.prototype.scrollIntoView).toHaveBeenCalledTimes(1);
            expect(Element.prototype.scrollIntoView.mock.contexts[0]).toBe(cards[1]);
            expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith(false);

            press('KeyD');
            press('KeyD');
            expect(borders()).toEqual(['5px', '0px', '0px']);

            press('KeyA');
            expect(borders()).toEqual(['0px', '0px', '5px']);
            expect(Element.prototype.scrollIntoView.mock.contexts[3]).toBe(cards[2]);
        });

        it('S and W move a whole row (results / 10 columns)', () => {
            open('/page/search?q=sapo&annotate=true', manyResults);

            press('KeyS');
            expect(borders().indexOf('5px')).toBe(2);
            press('KeyS');
            expect(borders().indexOf('5px')).toBe(4);
            press('KeyW');
            press('KeyW');
            press('KeyW');
            expect(borders().indexOf('5px')).toBe(10);
            expect(borders().filter((x) => x === '5px')).toHaveLength(1);
        });

        it('moves only through the lists directly inside #pages-results', () => {
            open('/page/search?q=sapo&annotate=true', SEARCH_TOOLS +
                `<section id="pages-results">${pageResult(1)}<div>${pageResult(2)}</div>${pageResult(3)}</section>`);

            press('KeyD');

            expect(pageCards()[0].style.borderWidth).toBe('0px');
            expect(pageCards()[1].style.borderWidth).toBe('');
            expect(pageCards()[2].style.borderWidth).toBe('5px');
        });

        it('Q steps the selected result up through the relevances', () => {
            open('/page/search?q=sapo&annotate=true');
            press('KeyD');

            press('KeyQ');
            expect(storedResults()[pageId(2)].relevance).toBe(0);
            expect(pageCards()[1].getAttribute('style')).toBe(RED);
            press('KeyQ');
            expect(storedResults()[pageId(2)].relevance).toBe(1);
            press('KeyQ');
            expect(storedResults()[pageId(2)].relevance).toBe(2);
            expect(pageCards()[1].getAttribute('style')).toBe(GREEN);
            expect(storedResults()[pageId(1)].relevance).toBe(-1);
        });

        it('E steps the selected result down through the relevances', () => {
            open('/page/search?q=sapo&annotate=true');
            relevanceButton(pageCards()[0], 'Muito relevante').click();

            press('KeyE');
            expect(storedResults()[pageId(1)].relevance).toBe(1);
            expect(pageCards()[0].getAttribute('style')).toBe(YELLOW);
            press('KeyE');
            expect(storedResults()[pageId(1)].relevance).toBe(0);
        });

        it.each([
            ['Digit1', 0, RED],
            ['Digit2', 1, YELLOW],
            ['Digit3', 2, GREEN],
        ])('%s gives every result not annotated yet relevance %s', (key, value, style) => {
            open('/page/search?q=sapo&annotate=true');
            relevanceButton(pageCards()[1], 'Conteúdo inacessível').click();

            press(key);

            expect([1, 2, 3].map((i) => storedResults()[pageId(i)].relevance)).toEqual([value, -2, value]);
            expect(pageCards().map((card) => card.getAttribute('style'))).toEqual([style, BLACK, style]);
        });

        it.each([
            ['KeyR', 'nextImage', '#next'],
            ['KeyT', 'previousImage', '#previous'],
        ])('%s follows the first link in #%s', (key, id, hash) => {
            open('/page/search?q=sapo&annotate=true',
                `${SEARCH_TOOLS}${pagesResults(1)}<div id="${id}"><a href="${hash}">go</a><a href="#other">other</a></div>`);

            press(key);

            expect(window.location.hash).toBe(hash);
        });
    });

    it('does not look for results outside the search pages', () => {
        localStorage.setItem('annotateKeyboard', 'true');
        open('/?annotate=true');

        jest.advanceTimersByTime(5000);
        press('Digit1');

        expect($id('startend').textContent).toBe('1 até 0');
        expect(document.querySelector('.ids')).toBeNull();
        expect(stored()).toBeNull();
    });

    describe('exporting', () => {
        it('downloads the annotations as a list per search', () => {
            open('/page/search?q=sapo&annotate=true');
            relevanceButton(pageCards()[0], 'Muito relevante').click();
            const downloads = [];
            jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
                downloads.push([this.getAttribute('download'), this.getAttribute('href'), this.isConnected, this.style.display]);
            });

            window.exportAnnotations();

            expect(downloads).toHaveLength(1);
            const [download, href, isConnected, display] = downloads[0];
            expect([download, isConnected, display]).toEqual(['annotations.json', true, 'none']);
            const prefix = 'data:text/plain;charset=utf-8,';
            expect(href.startsWith(prefix)).toBe(true);
            const exported = JSON.parse(decodeURIComponent(href.slice(prefix.length)));
            expect(exported.image).toEqual({ queries: [] });
            expect(exported.page.queries).toHaveLength(1);
            expect(exported.page.queries[0].query).toBe(QUERY);
            expect(exported.page.queries[0].results.map((x) => [x.id, x.relevance])).toEqual([
                [pageId(1), 2], [pageId(2), -1], [pageId(3), -1],
            ]);
            expect(document.querySelector('a[download]')).toBeNull();
        });
    });

    it('keeps the annotations when clearing them is not confirmed', () => {
        open('/page/search?q=sapo&annotate=true');
        jest.spyOn(window, 'confirm').mockReturnValue(false);

        window.clearAnnotations();

        expect(window.confirm).toHaveBeenCalledTimes(1);
        expect(Object.keys(storedResults())).toHaveLength(3);
    });

    it('waits for DOMContentLoaded when loaded from <head>', async () => {
        const fireDOMContentLoaded = await whileParsing();
        history.replaceState(null, '', '/page/search?q=sapo&annotate=true');

        setup();
        jest.advanceTimersByTime(500);
        expect(localStorage.getItem('annotate')).toBeNull();
        expect($id('clearAnnotationsButton')).toBeNull();
        expect(console.log).not.toHaveBeenCalled();

        fireDOMContentLoaded();
        expect($id('clearAnnotationsButton')).not.toBeNull();
        jest.advanceTimersByTime(500);
        expect(document.querySelectorAll('.ids')).toHaveLength(3);
    });
});
