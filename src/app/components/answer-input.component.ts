import { Component, effect, input, output, signal, computed, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Poll } from '../models/poll.model';
import { PollAnswer } from '../utils/poll-answer';

/**
 * Answer entry for question types that need more than a single tap:
 * multiple answers (checkboxes), short answer (text) and matching (one dropdown per prompt).
 * Emits `answered` once the participant presses Submit.
 */
@Component({
  selector: 'app-answer-input',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-3">
      @switch (poll().type) {
        @case ('multi_select') {
          <p class="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-1">
            Select all that apply
          </p>
          @for (opt of poll().options; track opt.id) {
            <button
              type="button"
              (click)="toggleOption(opt.id)"
              [disabled]="disabled()"
              [ngClass]="isSelected(opt.id)
                ? 'border-indigo-600 bg-indigo-50/80 dark:bg-indigo-950/50 ring-1 ring-indigo-500'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-indigo-300'"
              class="w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-3.5 active:scale-98 shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed">
              <span class="w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 text-xs"
                [ngClass]="isSelected(opt.id)
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'border-slate-300 dark:border-slate-600 text-transparent'">
                <i class="pi pi-check"></i>
              </span>
              <span class="text-sm font-bold text-slate-800 dark:text-slate-100 flex-1">{{ opt.text }}</span>
            </button>
          }
        }
        @case ('short_answer') {
          <label class="block text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-1">
            Type your answer
          </label>
          <input
            type="text"
            [value]="text()"
            (input)="text.set($any($event.target).value)"
            (keydown.enter)="submit()"
            [disabled]="disabled()"
            maxlength="200"
            autocomplete="off"
            placeholder="Your answer..."
            class="w-full p-4 rounded-2xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-white outline-none focus:border-indigo-500 disabled:opacity-60" />
        }
        @case ('matching') {
          <p class="text-[11px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 px-1">
            Match each item with its answer
          </p>
          @for (pair of poll().matchPairs || []; track pair.id) {
            <div class="p-3.5 rounded-2xl border-2 bg-white dark:bg-slate-900 space-y-2 transition-colors"
              [ngClass]="matches()[pair.id] ? 'border-indigo-300 dark:border-indigo-800' : 'border-slate-200 dark:border-slate-800'">
              <div class="text-sm font-bold text-slate-800 dark:text-slate-100">{{ pair.prompt }}</div>
              <select
                [disabled]="disabled()"
                (change)="setMatch(pair.id, $any($event.target).value)"
                class="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-indigo-500 disabled:opacity-60">
                <option value="" [selected]="!matches()[pair.id]">Choose...</option>
                @for (opt of poll().options; track opt.id) {
                  <option [value]="opt.text" [selected]="matches()[pair.id] === opt.text">{{ opt.text }}</option>
                }
              </select>
            </div>
          }
        }
      }

      <button
        type="button"
        (click)="submit()"
        [disabled]="disabled() || !canSubmit()"
        class="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-black shadow-md shadow-indigo-600/20 transition-all cursor-pointer border-0 disabled:opacity-40 disabled:cursor-not-allowed active:scale-98">
        Submit Answer
      </button>
    </div>
  `
})
export class AnswerInputComponent {
  poll = input.required<Poll>();
  disabled = input<boolean>(false);
  answered = output<PollAnswer>();

  private selected = signal<number[]>([]);
  text = signal<string>('');
  matches = signal<{ [pairId: number]: string }>({});

  canSubmit = computed(() => {
    const p = this.poll();
    switch (p.type) {
      case 'multi_select':
        return this.selected().length > 0;
      case 'short_answer':
        return this.text().trim().length > 0;
      case 'matching':
        return (p.matchPairs || []).length > 0 && (p.matchPairs || []).every(pair => !!this.matches()[pair.id]);
      default:
        return false;
    }
  });

  constructor() {
    // Start from a clean slate whenever a different question is shown
    effect(() => {
      this.poll().id;
      untracked(() => {
        this.selected.set([]);
        this.text.set('');
        this.matches.set({});
      });
    });
  }

  isSelected(optionId: number): boolean {
    return this.selected().includes(optionId);
  }

  toggleOption(optionId: number) {
    this.selected.update(list =>
      list.includes(optionId) ? list.filter(id => id !== optionId) : [...list, optionId]
    );
  }

  setMatch(pairId: number, value: string) {
    this.matches.update(m => ({ ...m, [pairId]: value }));
  }

  submit() {
    if (this.disabled() || !this.canSubmit()) return;
    const p = this.poll();
    if (p.type === 'multi_select') {
      this.answered.emit({ optionIds: [...this.selected()].sort((a, b) => a - b) });
    } else if (p.type === 'short_answer') {
      this.answered.emit({ textAnswer: this.text().trim() });
    } else if (p.type === 'matching') {
      const matches: { [pairId: string]: string } = {};
      for (const pair of p.matchPairs || []) {
        matches[String(pair.id)] = this.matches()[pair.id];
      }
      this.answered.emit({ matches });
    }
  }
}
