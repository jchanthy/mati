export interface ParsedQuestion {
  question: string;
  options: string[];
  correctOptionIndex?: number;
  type?: 'multichoice' | 'truefalse' | 'shortanswer';
}

/**
 * Service to parse Moodle XML and standard XML formats into question objects.
 */
export class MoodleXmlParser {
  /**
   * Cleans HTML markup (e.g., <p>, <br>, &nbsp;) and CDATA from question texts.
   */
  private static cleanText(raw: string): string {
    if (!raw) return '';
    let text = raw.trim();
    // Remove CDATA markers
    text = text.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
    // Strip HTML tags using browser DOMParser if available or regex fallback
    const temp = document.createElement('div');
    temp.innerHTML = text;
    const clean = temp.textContent || temp.innerText || '';
    return clean.trim();
  }

  /**
   * Parses Moodle XML format string into ParsedQuestion array.
   */
  static parse(xmlString: string): ParsedQuestion[] {
    const results: ParsedQuestion[] = [];
    if (!xmlString || !xmlString.trim()) return results;

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
      const questionElements = doc.querySelectorAll('question');
      questionElements.forEach((qEl) => {
        const type = qEl.getAttribute('type') || 'multichoice';
        if (type === 'category') return;

        // Extract Question Text
        const questionTextEl = qEl.querySelector('questiontext > text');
        let questionText = questionTextEl?.textContent || '';
        questionText = this.cleanText(questionText);

        if (!questionText) {
          const nameEl = qEl.querySelector('name > text');
          questionText = this.cleanText(nameEl?.textContent || '');
        }

        if (!questionText) return;

        const options: string[] = [];
        let correctIndex: number | undefined = undefined;

        // Parse answers
        const answerElements = qEl.querySelectorAll('answer');
        answerElements.forEach((aEl, idx) => {
          const textEl = aEl.querySelector('text');
          let answerText = textEl?.textContent || aEl.textContent || '';
          answerText = this.cleanText(answerText);
          if (answerText) {
            options.push(answerText);
            const fraction = parseFloat(aEl.getAttribute('fraction') || '0');
            if (fraction > 0 && correctIndex === undefined) {
              correctIndex = idx;
            }
          }
        });

        if (options.length === 0) {
          const genericOpts = qEl.querySelectorAll('option, choice');
          genericOpts.forEach((optEl, idx) => {
            const optText = this.cleanText(optEl.textContent || '');
            if (optText) {
              options.push(optText);
            }
          });
        }

        if (type === 'truefalse' && options.length === 0) {
          options.push('True (ពិត)', 'False (មិនពិត)');
        }

        if (options.length >= 2) {
          results.push({
            question: questionText,
            options,
            correctOptionIndex: correctIndex,
            type: type as any
          });
        }
      });
    }

    // If DOMParser failed or returned 0 questions, use Regex extractor
    if (results.length === 0) {
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

    return results;
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
  static parse(content: string, filename?: string): { format: 'csv' | 'xml'; questions: ParsedQuestion[] } {
    const trimmed = (content || '').trim();
    if (!trimmed) {
      return { format: 'csv', questions: [] };
    }

    const isExplicitCsv = filename?.toLowerCase().endsWith('.csv') || filename?.toLowerCase().endsWith('.tsv');
    const isExplicitXml = filename?.toLowerCase().endsWith('.xml');

    if (isExplicitXml || (trimmed.startsWith('<') && trimmed.includes('</'))) {
      const xmlQuestions = MoodleXmlParser.parse(content);
      if (xmlQuestions.length > 0 || isExplicitXml) {
        return { format: 'xml', questions: xmlQuestions };
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
