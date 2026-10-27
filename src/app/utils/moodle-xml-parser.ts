import { MatchPair, PollType } from '../models/poll.model';

export interface DropZoneMarker {
  no: number;
  x: number;
  y: number;
  w?: number;
  h?: number;
}

export interface ParsedQuestion {
  question: string;
  options: string[];
  /** Optional embedded images for each option (same length/index as `options`). */
  optionImages?: (string | undefined)[];
  /** Index of the (first) correct option. Kept for single-choice compatibility. */
  correctOptionIndex?: number;
  /** Indices of every correct option (multi-answer questions). */
  correctOptionIndices?: number[];
  type?: 'multichoice' | 'truefalse' | 'shortanswer' | 'matching' | 'ddwtos' | 'gapselect' | 'gapfill' | 'ddimageortext' | 'ddmarker';
  /** Original Moodle XML question type (e.g. 'ddimageortext', 'ddwtos', 'gapselect'). */
  moodleType?: string;
  /** MATI question type this question is imported as. Defaults to single choice. */
  pollType?: PollType;
  /** Optional embedded image (data URL) for the question stem or diagram. */
  imageUrl?: string;
  /** Accepted answers (short answer). */
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  /** Prompt → answer pairs (matching). `options` holds every selectable answer. */
  matchPairs?: Omit<MatchPair, 'id'>[];
  /** Drop zone coordinates for `ddimageortext` and `ddmarker` questions. */
  dropZones?: DropZoneMarker[];
}

/** Result of parsing a Moodle XML export, including question types MATI cannot import yet. */
export interface MoodleParseReport {
  questions: ParsedQuestion[];
  /** Number of skipped questions per unsupported Moodle type. */
  skipped: { type: string; count: number }[];
}

/**
 * Service to parse Moodle XML and standard XML formats into question objects.
 *
 * Supported Moodle question types:
 * - multichoice (single or multiple answers)
 * - truefalse
 * - shortanswer
 * - matching
 * - ddwtos (drag and drop into text)
 * - gapselect (select missing words)
 * - gapfill (gapfill)
 * - ddimageortext (drag and drop onto image)
 * - ddmarker (drag and drop markers)
 */
export class MoodleXmlParser {
  /**
   * Cleans HTML markup (e.g., <p>, <br>, &nbsp;, <table>) and CDATA from question texts.
   * Uses an inert DOMParser document so embedded images are never fetched.
   */
  private static cleanText(raw: string): string {
    if (!raw) return '';
    let text = raw.trim();
    // Remove CDATA markers
    text = text.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
    // Separate adjacent table cells with ' | ' so table rows remain readable
    text = text.replace(/<\/t[dh]>\s*<t[dh][^>]*>/gi, ' | ');
    // Preserve visual line breaks before stripping tags
    text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n');
    const parsed = new DOMParser().parseFromString(text, 'text/html');
    const clean = parsed.body?.textContent || '';
    return clean
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Raw HTML string inside the direct `<text>` child of an element. */
  private static rawChildHtml(parent: Element | null | undefined): string {
    if (!parent) return '';
    const textEl = Array.from(parent.children).find(c => c.tagName.toLowerCase() === 'text');
    const raw = textEl?.textContent ?? parent.textContent ?? '';
    return raw.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1').trim();
  }

  /** Text inside the direct `<text>` child of an element (Moodle wraps most values this way). */
  private static childText(parent: Element | null | undefined): string {
    if (!parent) return '';
    const textEl = Array.from(parent.children).find(c => c.tagName.toLowerCase() === 'text');
    return this.cleanText(textEl?.textContent ?? parent.textContent ?? '');
  }

  private static directChildren(parent: Element | null | undefined, tag: string): Element[] {
    if (!parent) return [];
    return Array.from(parent.children).filter(c => c.tagName.toLowerCase() === tag);
  }

  private static isTrue(value: string | null | undefined): boolean {
    const v = (value || '').trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
  }

  /** Converts a filename + base64 payload into a browser-renderable data URL. */
  private static fileToDataUrl(filename: string, base64Content: string): string | undefined {
    const cleanB64 = (base64Content || '').replace(/\s+/g, '');
    if (!cleanB64) return undefined;
    const lower = (filename || '').toLowerCase();
    let mime = 'image/png';
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) mime = 'image/jpeg';
    else if (lower.endsWith('.gif')) mime = 'image/gif';
    else if (lower.endsWith('.svg')) mime = 'image/svg+xml';
    else if (lower.endsWith('.webp')) mime = 'image/webp';
    return `data:${mime};base64,${cleanB64}`;
  }

  /**
   * Extracts an image referenced by `<img src="...">` inside `el`'s `<text>` child,
   * matching `@@PLUGINFILE@@/<filename>` against `<file>` elements in `el` or `fallbackFiles`.
   */
  private static extractHtmlImage(el: Element | null | undefined, fallbackFiles: Element[] = []): string | undefined {
    if (!el) return undefined;
    const html = this.rawChildHtml(el);
    const imgMatch = html.match(/<img[^>]+src=["']([^"']+)["']/i);
    const ownFiles = this.directChildren(el, 'file');
    const allFiles = [...ownFiles, ...fallbackFiles];

    if (imgMatch) {
      const src = imgMatch[1].trim();
      if (src.startsWith('data:image/')) {
        return src;
      }
      // Extract filename after @@PLUGINFILE@@/ or last slash, stripping query params
      const rawName = src.split('?')[0].split('/').pop() || '';
      let decodedName = rawName;
      try {
        decodedName = decodeURIComponent(rawName);
      } catch {
        decodedName = rawName;
      }
      const targetLower = decodedName.toLowerCase();
      const matchedFile = allFiles.find(f => {
        const name = (f.getAttribute('name') || '').trim();
        return name === decodedName || name.toLowerCase() === targetLower || name === rawName;
      }) || ownFiles[0];

      if (matchedFile) {
        return this.fileToDataUrl(matchedFile.getAttribute('name') || decodedName, matchedFile.textContent || '');
      }
    }
    return undefined;
  }

  /**
   * Extracts the first direct `<file>` child of `el` as a data URL (used by `ddimageortext` and `ddmarker`).
   */
  private static extractDirectFileImage(el: Element | null | undefined): string | undefined {
    if (!el) return undefined;
    const fileEl = this.directChildren(el, 'file')[0];
    if (!fileEl) return undefined;
    return this.fileToDataUrl(fileEl.getAttribute('name') || 'image.png', fileEl.textContent || '');
  }

  /**
   * Parses Moodle XML format string into ParsedQuestion array.
   */
  static parse(xmlString: string): ParsedQuestion[] {
    return this.parseWithReport(xmlString).questions;
  }

  /**
   * Parses Moodle XML and also reports which question types were skipped.
   */
  static parseWithReport(xmlString: string): MoodleParseReport {
    const results: ParsedQuestion[] = [];
    const skippedMap = new Map<string, number>();
    if (!xmlString || !xmlString.trim()) return { questions: results, skipped: [] };

    let doc: Document | null = null;
    try {
      const parser = new DOMParser();
      doc = parser.parseFromString(xmlString, 'text/xml');
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        doc = null; // fallback to regex parsing
      }
    } catch {
      doc = null;
    }

    if (doc) {
      const questionElements = Array.from(doc.querySelectorAll('question'));
      for (const qEl of questionElements) {
        const type = (qEl.getAttribute('type') || 'multichoice').trim().toLowerCase();
        if (type === 'category' || type === 'description') continue;

        const qTextEl = this.directChildren(qEl, 'questiontext')[0];
        let questionText = this.childText(qTextEl);
        if (!questionText) {
          questionText = this.childText(this.directChildren(qEl, 'name')[0]);
        }
        if (!questionText) continue;

        const parsed = this.parseQuestionByType(qEl, type, questionText, qTextEl);
        if (parsed === 'unsupported') {
          skippedMap.set(type, (skippedMap.get(type) || 0) + 1);
        } else if (parsed) {
          results.push(parsed);
        }
      }
    }

    // If DOMParser failed or returned 0 questions, use Regex extractor
    if (!doc && results.length === 0) {
      const questionBlocks = xmlString.match(/<question[\s\S]*?<\/question>/gi) || [];
      for (const block of questionBlocks) {
        if (/type=["']category["']/i.test(block)) continue;

        let qText = '';
        const qMatch = block.match(/<questiontext[\s\S]*?<text[\s\S]*?>([\s\S]*?)<\/text>/i) ||
                       block.match(/<name[\s\S]*?<text[\s\S]*?>([\s\S]*?)<\/text>/i);
        if (qMatch) {
          qText = this.cleanText(qMatch[1]);
        }

        if (!qText) continue;

        const options: string[] = [];
        const answerBlocks = block.match(/<answer[\s\S]*?<\/answer>/gi) || 
                             block.match(/<(?:option|choice)[\s\S]*?<\/(?:option|choice)>/gi) || [];

        for (const aBlock of answerBlocks) {
          const aMatch = aBlock.match(/<text[\s\S]*?>([\s\S]*?)<\/text>/i);
          let ansText = '';
          if (aMatch) {
            ansText = this.cleanText(aMatch[1]);
          } else {
            ansText = this.cleanText(aBlock.replace(/<[^>]+>/g, ''));
          }
          if (ansText && !options.includes(ansText)) {
            options.push(ansText);
          }
        }

        if (options.length >= 2) {
          results.push({
            question: qText,
            options,
            type: 'multichoice',
            moodleType: 'multichoice'
          });
        }
      }
    }

    return {
      questions: results,
      skipped: Array.from(skippedMap.entries()).map(([type, count]) => ({ type, count }))
    };
  }

  /**
   * Converts one Moodle `<question>` element into a ParsedQuestion.
   * Returns 'unsupported' for question types MATI cannot render yet, or null when the question is malformed.
   */
  private static parseQuestionByType(
    qEl: Element,
    type: string,
    questionText: string,
    qTextEl?: Element
  ): ParsedQuestion | 'unsupported' | null {
    const answerEls = this.directChildren(qEl, 'answer');
    const qTextFiles = this.directChildren(qTextEl, 'file');
    const questionImage = this.extractHtmlImage(qTextEl);

    switch (type) {
      case 'multichoice': {
        const options: string[] = [];
        const optionImages: (string | undefined)[] = [];
        const fractions: number[] = [];
        for (const aEl of answerEls) {
          let text = this.childText(aEl);
          const optImg = this.extractHtmlImage(aEl, qTextFiles) || this.extractDirectFileImage(aEl);
          if (!text && !optImg) continue;
          if (!text && optImg) {
            text = `ជម្រើសទី ${options.length + 1}`;
          }
          options.push(text);
          optionImages.push(optImg);
          fractions.push(parseFloat(aEl.getAttribute('fraction') || '0'));
        }
        if (options.length < 2) return null;

        const hasOptionImages = optionImages.some(Boolean);
        const isSingle = this.isTrue(this.directChildren(qEl, 'single')[0]?.textContent ?? 'true');
        if (isSingle) {
          const best = Math.max(...fractions);
          const correctIndex = best > 0 ? fractions.indexOf(best) : undefined;
          return {
            question: questionText,
            options,
            optionImages: hasOptionImages ? optionImages : undefined,
            imageUrl: questionImage,
            correctOptionIndex: correctIndex,
            correctOptionIndices: correctIndex !== undefined ? [correctIndex] : undefined,
            type: 'multichoice',
            moodleType: 'multichoice',
            pollType: 'multiple_choice'
          };
        }

        const correctIndices = fractions.map((f, i) => (f > 0 ? i : -1)).filter(i => i >= 0);
        return {
          question: questionText,
          options,
          optionImages: hasOptionImages ? optionImages : undefined,
          imageUrl: questionImage,
          correctOptionIndex: correctIndices[0],
          correctOptionIndices: correctIndices.length > 0 ? correctIndices : undefined,
          type: 'multichoice',
          moodleType: 'multichoice',
          pollType: 'multi_select'
        };
      }

      case 'truefalse': {
        const options = ['True (ពិត)', 'False (មិនពិត)'];
        let correctIndex: number | undefined;
        for (const aEl of answerEls) {
          const text = this.childText(aEl).toLowerCase();
          const fraction = parseFloat(aEl.getAttribute('fraction') || '0');
          if (fraction > 0) {
            correctIndex = text === 'false' ? 1 : 0;
            break;
          }
        }
        return {
          question: questionText,
          options,
          imageUrl: questionImage,
          correctOptionIndex: correctIndex,
          correctOptionIndices: correctIndex !== undefined ? [correctIndex] : undefined,
          type: 'truefalse',
          moodleType: 'truefalse',
          pollType: 'true_false'
        };
      }

      case 'shortanswer': {
        const accepted = answerEls
          .filter(a => parseFloat(a.getAttribute('fraction') || '0') > 0)
          .map(a => this.childText(a))
          .filter(t => t.length > 0);
        if (accepted.length === 0) return null;
        return {
          question: questionText,
          options: [],
          imageUrl: questionImage,
          type: 'shortanswer',
          moodleType: 'shortanswer',
          pollType: 'short_answer',
          acceptedAnswers: Array.from(new Set(accepted)),
          caseSensitive: this.isTrue(this.directChildren(qEl, 'usecase')[0]?.textContent)
        };
      }

      case 'matching': {
        const pairs: Omit<MatchPair, 'id'>[] = [];
        const options: string[] = [];
        for (const sub of this.directChildren(qEl, 'subquestion')) {
          let prompt = this.childText(sub);
          const subImg = this.extractHtmlImage(sub, qTextFiles) || this.extractDirectFileImage(sub);
          const answer = this.childText(this.directChildren(sub, 'answer')[0]);
          if (!answer) continue;
          if (!options.includes(answer)) options.push(answer);
          if (!prompt && subImg) {
            prompt = `រូបភាពទី ${pairs.length + 1}`;
          }
          if (prompt) {
            pairs.push({
              prompt,
              answer,
              ...(subImg ? { imageUrl: subImg } : {})
            });
          }
        }
        if (pairs.length === 0 || options.length < 2) return null;
        return {
          question: questionText,
          options,
          imageUrl: questionImage,
          type: 'matching',
          moodleType: 'matching',
          pollType: 'matching',
          matchPairs: pairs
        };
      }

      case 'ddwtos':
      case 'gapselect': {
        const tag = type === 'ddwtos' ? 'dragbox' : 'selectoption';
        const choiceEls = this.directChildren(qEl, tag);
        const choiceTexts = choiceEls.map(c => this.childText(c));
        const options = Array.from(new Set(choiceTexts.filter(t => t.length > 0)));

        // Find all [[N]] placeholders in order of appearance
        const placeholderMatches = Array.from(questionText.matchAll(/\[\[(\d+)\]\]/g));
        const pairs: Omit<MatchPair, 'id'>[] = [];
        const seenNums = new Set<number>();

        for (const match of placeholderMatches) {
          const num = parseInt(match[1], 10);
          if (isNaN(num) || seenNums.has(num)) continue;
          seenNums.add(num);
          const answer = choiceTexts[num - 1];
          if (answer) {
            pairs.push({
              prompt: `ចន្លោះ [${num}]`,
              answer
            });
          }
        }

        const formattedQuestion = questionText.replace(/\[\[(\d+)\]\]/g, '[$1]');
        if (pairs.length === 0 || options.length === 0) return null;

        return {
          question: formattedQuestion,
          options,
          imageUrl: questionImage,
          type: type as 'ddwtos' | 'gapselect',
          moodleType: type,
          pollType: 'matching',
          matchPairs: pairs
        };
      }

      case 'gapfill': {
        const formatGapAnswer = (s: string) => s.split('|').map(p => p.trim()).filter(Boolean).join(', ');
        const answers = answerEls.map(a => formatGapAnswer(this.childText(a))).filter(t => t.length > 0);
        const options = Array.from(new Set(answers));
        const pairs: Omit<MatchPair, 'id'>[] = [];
        const gapMap = new Map<string, number>();
        let gapIndex = 0;

        // Collapse repeated identical [a|b] gaps on the same line and number each unique gap [1], [2], ...
        let formattedQuestion = questionText.replace(/(\[[^\[\]]+\])(?:\s*\1)+/g, '$1');
        formattedQuestion = formattedQuestion.replace(/\[([^\[\]]+)\]/g, (_full, inner) => {
          const cleanInner = formatGapAnswer(inner.trim());
          const matchedAns = answers.find(a => a.toLowerCase() === cleanInner.toLowerCase()) || cleanInner;
          const key = matchedAns.toLowerCase();
          let idx = gapMap.get(key);
          if (!idx) {
            gapIndex++;
            idx = gapIndex;
            gapMap.set(key, idx);
            if (!options.includes(matchedAns)) {
              options.push(matchedAns);
            }
            pairs.push({
              prompt: `ចន្លោះ [${idx}]`,
              answer: matchedAns
            });
          }
          return `[${idx}]`;
        });

        if (pairs.length === 0 || options.length === 0) return null;
        return {
          question: formattedQuestion,
          options,
          imageUrl: questionImage,
          type: 'gapfill',
          moodleType: 'gapfill',
          pollType: 'matching',
          matchPairs: pairs
        };
      }

      case 'ddimageortext':
      case 'ddmarker': {
        const bgImage = this.extractDirectFileImage(qEl) || questionImage;
        const dragEls = this.directChildren(qEl, 'drag');
        const dropEls = this.directChildren(qEl, 'drop');

        const dragMap = new Map<number, { label: string; imageUrl?: string }>();
        const options: string[] = [];
        const optionImages: (string | undefined)[] = [];

        for (let i = 0; i < dragEls.length; i++) {
          const dEl = dragEls[i];
          const no = parseInt(this.directChildren(dEl, 'no')[0]?.textContent || String(i + 1), 10);
          let label = this.childText(dEl);
          const dragImg = this.extractDirectFileImage(dEl) || this.extractHtmlImage(dEl, qTextFiles);
          if (!label && dragImg) {
            label = `រូបភាព ${String.fromCharCode(64 + (isNaN(no) ? i + 1 : no))}`;
          }
          if (!label) continue;
          dragMap.set(no, { label, imageUrl: dragImg });
          if (!options.includes(label)) {
            options.push(label);
            optionImages.push(dragImg);
          }
        }

        const dropZones: DropZoneMarker[] = [];
        const pairs: Omit<MatchPair, 'id'>[] = [];

        for (let i = 0; i < dropEls.length; i++) {
          const dropEl = dropEls[i];
          const no = parseInt(this.directChildren(dropEl, 'no')[0]?.textContent || String(i + 1), 10);
          const choiceNo = parseInt(this.directChildren(dropEl, 'choice')[0]?.textContent || '0', 10);
          const dragItem = dragMap.get(choiceNo);
          if (!dragItem) continue;

          let x = 0;
          let y = 0;
          let w: number | undefined;
          let h: number | undefined;

          if (type === 'ddimageortext') {
            x = parseFloat(this.directChildren(dropEl, 'xleft')[0]?.textContent || '0');
            y = parseFloat(this.directChildren(dropEl, 'ytop')[0]?.textContent || '0');
          } else {
            // ddmarker coords format: "x,y;w,h" or "x,y;r"
            const coordsRaw = (this.directChildren(dropEl, 'coords')[0]?.textContent || '').trim();
            const parts = coordsRaw.split(';');
            const xy = (parts[0] || '').split(',').map(v => parseFloat(v.trim()));
            x = xy[0] || 0;
            y = xy[1] || 0;
            if (parts[1]) {
              const wh = parts[1].split(',').map(v => parseFloat(v.trim()));
              if (wh.length >= 2 && !isNaN(wh[0]) && !isNaN(wh[1])) {
                w = wh[0];
                h = wh[1];
              } else if (wh.length === 1 && !isNaN(wh[0])) {
                w = wh[0] * 2;
                h = wh[0] * 2;
              }
            }
          }

          dropZones.push({ no, x, y, w, h });
          pairs.push({
            prompt: `ទីតាំង [${no}]`,
            answer: dragItem.label
          });
        }

        // Special case: single-marker target question (e.g. Windows-017 where drag label is "." and there is 1 drop zone)
        if (dropZones.length === 1 && options.length === 1) {
          const targetZone = dropZones[0];
          const bw = targetZone.w || 120;
          const bh = targetZone.h || 32;
          const allZones: DropZoneMarker[] = [
            { no: 1, x: targetZone.x, y: targetZone.y, w: bw, h: bh },
            { no: 2, x: targetZone.x + bw + 25, y: targetZone.y, w: bw, h: bh },
            { no: 3, x: targetZone.x, y: targetZone.y + 140, w: bw, h: bh },
            { no: 4, x: targetZone.x + bw + 25, y: targetZone.y + 140, w: bw, h: bh }
          ];
          return {
            question: questionText,
            options: ['ទីតាំង [1]', 'ទីតាំង [2]', 'ទីតាំង [3]', 'ទីតាំង [4]'],
            correctOptionIndex: 0,
            correctOptionIndices: [0],
            imageUrl: bgImage,
            type: type as 'ddimageortext' | 'ddmarker',
            moodleType: type,
            pollType: 'multiple_choice',
            dropZones: allZones
          };
        }

        if (pairs.length === 0 || options.length === 0) return null;
        const hasOptionImages = optionImages.some(Boolean);

        return {
          question: questionText,
          options,
          optionImages: hasOptionImages ? optionImages : undefined,
          imageUrl: bgImage,
          type: type as 'ddimageortext' | 'ddmarker',
          moodleType: type,
          pollType: 'matching',
          matchPairs: pairs,
          dropZones
        };
      }

      default:
        return 'unsupported';
    }
  }
}

/**
 * Service to parse standard CSV/TSV formats into question objects.
 * Supports:
 * - RFC 4180 quotes, embedded commas, and escaped quotes ("")
 * - Delimiters: comma (,), semicolon (;), and tab (\t)
 * - Variable number of options (2 to 8 choices)
 * - Correct answer column: numbers (1, 2, 3), letters (A, B, C), or matching text
 * - Multilingual and UTF-8 / Khmer Unicode content
 */
export class CsvQuestionParser {
  /**
   * Parse CSV string into array of rows (string[][]),
   * handling quotes, custom delimiters, and multiline cells.
   */
  static parseCsvRows(csvText: string): string[][] {
    let text = csvText.replace(/^\uFEFF/, '').trim();
    if (!text) return [];

    // Auto-detect delimiter from the first line
    const firstLine = text.split(/\r\n|\n|\r/)[0] || '';
    let delimiter = ',';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semicolonCount = (firstLine.match(/;/g) || []).length;
    const tabCount = (firstLine.match(/\t/g) || []).length;
    if (semicolonCount > commaCount && semicolonCount > tabCount) {
      delimiter = ';';
    } else if (tabCount > commaCount && tabCount > semicolonCount) {
      delimiter = '\t';
    }

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;
    let i = 0;

    while (i < text.length) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (insideQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentField += '"';
            i += 2;
            continue;
          } else {
            insideQuotes = false;
            i++;
            continue;
          }
        } else {
          currentField += char;
          i++;
          continue;
        }
      } else {
        if (char === '"') {
          insideQuotes = true;
          i++;
          continue;
        } else if (char === delimiter) {
          currentRow.push(currentField.trim());
          currentField = '';
          i++;
          continue;
        } else if (char === '\r' || char === '\n') {
          if (char === '\r' && nextChar === '\n') {
            i += 2;
          } else {
            i++;
          }
          currentRow.push(currentField.trim());
          if (currentRow.some(col => col.length > 0)) {
            rows.push(currentRow);
          }
          currentRow = [];
          currentField = '';
          continue;
        } else {
          currentField += char;
          i++;
          continue;
        }
      }
    }

    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(col => col.length > 0)) {
        rows.push(currentRow);
      }
    }

    return rows;
  }

  /**
   * Parses CSV string into ParsedQuestion array.
   */
  static parse(csvText: string): ParsedQuestion[] {
    const rows = this.parseCsvRows(csvText);
    if (rows.length === 0) return [];

    const questions: ParsedQuestion[] = [];
    let startIdx = 0;

    // Check if the first row is a header row
    const firstRow = rows[0].map(c => c.toLowerCase());
    const isHeader = firstRow.some(c => 
      c.includes('question') || 
      c.includes('option') || 
      c.includes('answer') || 
      c.includes('choice') ||
      c.includes('correct') ||
      c.includes('សំណួរ') ||
      c.includes('ចម្លើយ')
    );

    if (isHeader) {
      startIdx = 1;
    }

    for (let r = startIdx; r < rows.length; r++) {
      const cols = rows[r].filter(c => c !== undefined);
      if (cols.length < 2) continue;

      const questionText = cols[0].trim();
      if (!questionText) continue;

      let rawOptions = cols.slice(1).map(c => c.trim()).filter(c => c.length > 0);
      if (rawOptions.length === 0) continue;

      let correctIndex: number | undefined = undefined;

      // Detect if the last column is a correct answer indicator
      const lastCol = rawOptions[rawOptions.length - 1];
      const secondLastExists = rawOptions.length >= 3;

      if (secondLastExists) {
        const numVal = parseInt(lastCol, 10);
        // Case 1: Number (1-based index, e.g. 1, 2, 3)
        if (!isNaN(numVal) && numVal >= 1 && numVal <= rawOptions.length - 1 && /^\d+$/.test(lastCol)) {
          correctIndex = numVal - 1;
          rawOptions.pop();
        }
        // Case 2: Letter (A, B, C, D)
        else if (/^[A-Za-z]$/.test(lastCol)) {
          const letterIdx = lastCol.toUpperCase().charCodeAt(0) - 65;
          if (letterIdx >= 0 && letterIdx < rawOptions.length - 1) {
            correctIndex = letterIdx;
            rawOptions.pop();
          }
        }
        // Case 3: Exact match with one of the preceding option texts
        else {
          const matchingIdx = rawOptions.slice(0, rawOptions.length - 1).findIndex(
            opt => opt.toLowerCase() === lastCol.toLowerCase()
          );
          if (matchingIdx >= 0) {
            correctIndex = matchingIdx;
            rawOptions.pop();
          }
        }
      }

      if (rawOptions.length >= 2) {
        questions.push({
          question: questionText,
          options: rawOptions,
          correctOptionIndex: correctIndex,
          type: 'multichoice'
        });
      } else if (rawOptions.length === 1 && (rawOptions[0].toLowerCase() === 'true' || rawOptions[0].toLowerCase() === 'false')) {
        questions.push({
          question: questionText,
          options: ['True (ពិត)', 'False (មិនពិត)'],
          correctOptionIndex: rawOptions[0].toLowerCase() === 'true' ? 0 : 1,
          type: 'truefalse'
        });
      }
    }

    return questions;
  }
}

/**
 * Unified Question Importer: auto-detects CSV or Moodle XML format.
 */
export class QuestionImporter {
  static parse(content: string, filename?: string): { format: 'csv' | 'xml'; questions: ParsedQuestion[]; skipped?: { type: string; count: number }[] } {
    const trimmed = (content || '').trim();
    if (!trimmed) {
      return { format: 'csv', questions: [] };
    }

    const isExplicitCsv = filename?.toLowerCase().endsWith('.csv') || filename?.toLowerCase().endsWith('.tsv');
    const isExplicitXml = filename?.toLowerCase().endsWith('.xml');

    if (isExplicitXml || (trimmed.startsWith('<') && trimmed.includes('</'))) {
      const xmlReport = MoodleXmlParser.parseWithReport(content);
      const xmlQuestions = xmlReport.questions;
      if (xmlQuestions.length > 0 || isExplicitXml || xmlReport.skipped.length > 0) {
        return { format: 'xml', questions: xmlQuestions, skipped: xmlReport.skipped };
      }
    }

    // Try CSV parser
    const csvQuestions = CsvQuestionParser.parse(content);
    if (csvQuestions.length > 0 || isExplicitCsv) {
      return { format: 'csv', questions: csvQuestions };
    }

    // Fallback: try XML
    const xmlFallback = MoodleXmlParser.parse(content);
    if (xmlFallback.length > 0) {
      return { format: 'xml', questions: xmlFallback };
    }

    return { format: 'csv', questions: [] };
  }

  /**
   * Compresses embedded base64 images so Firestore documents stay well under the 1 MiB limit,
   * and draws numbered drop-zone markers ([1], [2], ...) onto `ddimageortext` / `ddmarker` diagrams.
   */
  static async compressAndAnnotateQuestions(questions: ParsedQuestion[]): Promise<ParsedQuestion[]> {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
      return questions;
    }

    const processImage = (
      dataUrl: string | undefined,
      maxDim: number,
      dropZones?: DropZoneMarker[]
    ): Promise<string | undefined> => {
      if (!dataUrl || !dataUrl.startsWith('data:image/')) {
        return Promise.resolve(dataUrl);
      }
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          try {
            const natW = img.naturalWidth || img.width || 400;
            const natH = img.naturalHeight || img.height || 300;
            const hasZones = !!(dropZones && dropZones.length > 0);
            const scale = Math.min(1, maxDim / Math.max(natW, natH));
            const outW = Math.max(1, Math.round(natW * scale));
            const outH = Math.max(1, Math.round(natH * scale));

            // Skip re-encoding tiny images without drop zones
            if (!hasZones && dataUrl.length < 45_000 && scale === 1) {
              resolve(dataUrl);
              return;
            }

            const canvas = document.createElement('canvas');
            canvas.width = outW;
            canvas.height = outH;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(dataUrl);
              return;
            }

            // Fill white background so transparent PNGs render cleanly in JPEG
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, outW, outH);
            ctx.drawImage(img, 0, 0, outW, outH);

            if (hasZones && dropZones) {
              for (const z of dropZones) {
                const zx = Math.round(z.x * scale);
                const zy = Math.round(z.y * scale);
                const zw = z.w ? Math.round(z.w * scale) : Math.round(52 * scale);
                const zh = z.h ? Math.round(z.h * scale) : Math.round(28 * scale);

                // Draw dashed drop-zone highlight box
                ctx.save();
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = Math.max(2, Math.round(2.5 * scale));
                ctx.fillRect(zx, zy, Math.max(28, zw), Math.max(22, zh));
                ctx.strokeRect(zx, zy, Math.max(28, zw), Math.max(22, zh));

                // Draw numbered badge [N] inside top-left of the zone
                const label = `[${z.no}]`;
                const fontSize = Math.max(12, Math.min(18, Math.round(15 * scale)));
                ctx.font = `bold ${fontSize}px sans-serif`;
                ctx.textBaseline = 'middle';
                ctx.textAlign = 'center';
                const badgeW = Math.max(28, ctx.measureText(label).width + 10);
                const badgeH = Math.max(20, fontSize + 6);
                const bx = Math.min(outW - badgeW - 2, Math.max(2, zx));
                const by = Math.min(outH - badgeH - 2, Math.max(2, zy));

                ctx.fillStyle = '#dc2626';
                ctx.fillRect(bx, by, badgeW, badgeH);
                ctx.fillStyle = '#ffffff';
                ctx.fillText(label, bx + badgeW / 2, by + badgeH / 2);
                ctx.restore();
              }
            }

            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            resolve(compressed.length < dataUrl.length || hasZones ? compressed : dataUrl);
          } catch {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    };

    const out: ParsedQuestion[] = [];
    for (const q of questions) {
      const imageUrl = await processImage(q.imageUrl, 850, q.dropZones);
      let optionImages = q.optionImages;
      if (optionImages && optionImages.some(Boolean)) {
        optionImages = await Promise.all(optionImages.map(img => processImage(img, 320)));
      }
      let matchPairs = q.matchPairs;
      if (matchPairs && matchPairs.some(p => !!p.imageUrl)) {
        matchPairs = await Promise.all(
          matchPairs.map(async p => ({
            ...p,
            ...(p.imageUrl ? { imageUrl: await processImage(p.imageUrl, 320) } : {})
          }))
        );
      }
      out.push({
        ...q,
        ...(imageUrl ? { imageUrl } : {}),
        ...(optionImages ? { optionImages } : {}),
        ...(matchPairs ? { matchPairs } : {})
      });
    }
    return out;
  }
}
