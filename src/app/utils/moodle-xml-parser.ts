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

    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parse error
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('Invalid XML format: ' + parseError.textContent?.substring(0, 100));
    }

    const questionElements = doc.querySelectorAll('question');

    questionElements.forEach((qEl) => {
      const type = qEl.getAttribute('type');
      // Skip category or unsupported meta questions
      if (type === 'category' || !type) return;

      // Extract Question Text
      const questionTextEl = qEl.querySelector('questiontext > text');
      let questionText = questionTextEl?.textContent || '';
      questionText = this.cleanText(questionText);

      // If no questiontext found, try name > text or prompt
      if (!questionText) {
        const nameEl = qEl.querySelector('name > text');
        questionText = this.cleanText(nameEl?.textContent || '');
      }

      if (!questionText) return;

      const options: string[] = [];
      let correctIndex: number | undefined = undefined;

      // Parse answers (multichoice / truefalse)
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

      // Also support custom/generic XML tags: <option> or <choice>
      if (options.length === 0) {
        const genericOpts = qEl.querySelectorAll('option, choice');
        genericOpts.forEach((optEl, idx) => {
          const optText = this.cleanText(optEl.textContent || '');
          if (optText) {
            options.push(optText);
            const isCorrect = optEl.getAttribute('correct') === 'true' || optEl.getAttribute('isCorrect') === '1';
            if (isCorrect && correctIndex === undefined) {
              correctIndex = idx;
            }
          }
        });
      }

      // Default fallback options for True/False if not specified
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

    return results;
  }
}
