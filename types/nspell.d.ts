declare module 'nspell' {
  export interface NspellOptions {
    // Opzioni di configurazione
  }

  export default class Nspell {
    constructor(aff: string, dic: string, options?: NspellOptions)
    
    /**
     * Controlla se una parola è corretta
     */
    correct(word: string): boolean
    
    /**
     * Ottiene i suggerimenti per una parola errata
     */
    suggest(word: string): string[]
    
    /**
     * Aggiunge una parola al dizionario personalizzato
     */
    add(word: string): void
    
    /**
     * Rimuove una parola dal dizionario personalizzato
     */
    remove(word: string): void
  }
}
