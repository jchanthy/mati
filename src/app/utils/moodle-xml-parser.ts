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
