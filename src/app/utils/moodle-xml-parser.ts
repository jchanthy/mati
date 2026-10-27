import { MatchPair, PollType } from '../models/poll.model';

export interface ParsedQuestion {
  question: string;
  options: string[];
  /** Index of the (first) correct option. Kept for single-choice compatibility. */
  correctOptionIndex?: number;
  /** Indices of every correct option (multi-answer questions). */
  correctOptionIndices?: number[];
  type?: 'multichoice' | 'truefalse' | 'shortanswer' | 'matching';
  /** MATI question type this question is imported as. Defaults to single choice. */
  pollType?: PollType;
  /** Accepted answers (short answer). */
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  /** Prompt → answer pairs (matching). `options` holds every selectable answer. */
  matchPairs?: Omit<MatchPair, 'id'>[];
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
 * - multichoice (single or multiple answers), truefalse, shortanswer, matching
 */
export class MoodleXmlParser {
  /**
   * Cleans HTML markup (e.g., <p>, <br>, &nbsp;) and CDATA from question texts.
   * Uses an inert DOMParser document so embedded images are never fetched.
   */
  private static cleanText(raw: string): string {
    if (!raw) return '';
    let text = raw.trim();
    // Remove CDATA markers
    text = text.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
    // Preserve visual line breaks before stripping tags
    text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr)>/gi, '\n');
    const parsed = new DOMParser().parseFromString(text, 'text/html');
    const clean = parsed.body?.textContent || '';
    return clean.replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  /** Text inside the direct `<text>` child of an element (Moodle wraps most values this way). */
  private static childText(parent: Element | null | undefined): string {
    if (!parent) return '';
    const textEl = Array.from(parent.children).find(c => c.tagName.toLowerCase() === 'text');
    return this.cleanText(textEl?.textContent ?? parent.textContent ?? '');
  }

  private static directChildren(parent: Element, tag: string): Element[] {
    return Array.from(parent.children).filter(c => c.tagName.toLowerCase() === tag);
  }

  private static isTrue(value: string | null | undefined): boolean {
    const v = (value || '').trim().toLowerCase();
    return v === 'true' || v === '1' || v === 'yes';
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
        const type = qEl.getAttribute('type') || 'multichoice';
        if (type === 'category') continue;

        // Extract Question Text
        let questionText = this.childText(this.directChildren(qEl, 'questiontext')[0]);
        if (!questionText) {
          questionText = this.childText(this.directChildren(qEl, 'name')[0]);
        }
        if (!questionText) continue;

        const parsed = this.parseQuestionByType(qEl, type, questionText);
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

        // Question text
        let qText = '';
        const qMatch = block.match(/<questiontext[\s\S]*?<text[\s\S]*?>([\s\S]*?)<\/text>/i) ||
                       block.match(/<name[\s\S]*?<text[\s\S]*?>([\s\S]*?)<\/text>/i);
        if (qMatch) {
          qText = this.cleanText(qMatch[1]);
        }

        if (!qText) continue;

        // Answers
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
            type: 'multichoice'
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
  private static parseQuestionByType(qEl: Element, type: string, questionText: string): ParsedQuestion | 'unsupported' | null {
    const answerEls = this.directChildren(qEl, 'answer');

    switch (type) {
      case 'multichoice': {
        const options: string[] = [];
        const fractions: number[] = [];
        for (const aEl of answerEls) {
          const text = this.childText(aEl);
          if (!text) continue;
          options.push(text);
          fractions.push(parseFloat(aEl.getAttribute('fraction') || '0'));
        }
        if (options.length < 2) return null;

        const isSingle = this.isTrue(this.directChildren(qEl, 'single')[0]?.textContent ?? 'true');
        if (isSingle) {
          // Single answer: the option with the highest positive fraction is the key
          const best = Math.max(...fractions);
          const correctIndex = best > 0 ? fractions.indexOf(best) : undefined;
          return {
            question: questionText,
            options,
            correctOptionIndex: correctIndex,
            correctOptionIndices: correctIndex !== undefined ? [correctIndex] : undefined,
            type: 'multichoice',
            pollType: 'multiple_choice'
          };
        }

        // Multiple answers: every positively weighted option must be selected
        const correctIndices = fractions.map((f, i) => (f > 0 ? i : -1)).filter(i => i >= 0);
        return {
          question: questionText,
          options,
          correctOptionIndex: correctIndices[0],
          correctOptionIndices: correctIndices.length > 0 ? correctIndices : undefined,
          type: 'multichoice',
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
          correctOptionIndex: correctIndex,
          correctOptionIndices: correctIndex !== undefined ? [correctIndex] : undefined,
          type: 'truefalse',
          pollType: 'true_false'
        };
      }

      case 'shortanswer': {
        // Only fully weighted answers count (all-or-nothing grading)
        const accepted = answerEls
          .filter(a => parseFloat(a.getAttribute('fraction') || '0') >= 99.99)
          .map(a => this.childText(a))
          .filter(t => t.length > 0);
        if (accepted.length === 0) return null;
        return {
          question: questionText,
          options: [],
          type: 'shortanswer',
          pollType: 'short_answer',
          acceptedAnswers: Array.from(new Set(accepted)),
          caseSensitive: this.isTrue(this.directChildren(qEl, 'usecase')[0]?.textContent)
        };
      }

      case 'matching': {
        const pairs: Omit<MatchPair, 'id'>[] = [];
        const options: string[] = [];
        for (const sub of this.directChildren(qEl, 'subquestion')) {
          const prompt = this.childText(sub);
          const answer = this.childText(this.directChildren(sub, 'answer')[0]);
          if (!answer) continue;
          if (!options.includes(answer)) options.push(answer);
          if (prompt) pairs.push({ prompt, answer });
        }
        if (pairs.length === 0 || options.length < 2) return null;
        return {
          question: questionText,
          options,
          type: 'matching',
          pollType: 'matching',
          matchPairs: pairs
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
}
