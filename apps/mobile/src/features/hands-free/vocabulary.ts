import type { Locale } from '@remote-harness/protocol'

/**
 * Words the hands-free mode understands, per transcription language, lowercase and without accents
 * (`normalize` in `commands.ts` strips them from what was heard). A command is a whole utterance
 * made of these words, so a message that merely contains "yes" is still a message.
 */
export type Vocabulary = {
  allow: string[]
  deny: string[]
  yes: string[]
  no: string[]
  repeat: string[]
  stop: string[]
  /** Words before an option number ("option 2", "number 2"). */
  option: string[]
  /** Words joining several options ("1 and 3"). */
  and: string[]
  /** Number words 1–10, in order. */
  numbers: string[][]
  /** Ordinals 1–10 ("first", "second"), in order. */
  ordinals: string[][]
}

export const VOCABULARY: Record<Locale, Vocabulary> = {
  'en-US': {
    allow: ['allow', 'approve', 'accept', 'allow it'],
    deny: ['deny', 'reject', 'decline', 'deny it'],
    yes: ['yes', 'yeah', 'yep', 'send', 'send it', 'confirm', 'ok', 'okay'],
    no: ['no', 'nope', 'cancel', 'dont send', 'never mind'],
    repeat: ['repeat', 'again', 'say again', 'repeat that', 'what'],
    stop: ['stop', 'exit', 'quit', 'stop hands free', 'turn off'],
    option: ['option', 'number', 'choice'],
    and: ['and', 'plus'],
    numbers: [
      ['one'],
      ['two', 'to'],
      ['three'],
      ['four'],
      ['five'],
      ['six'],
      ['seven'],
      ['eight'],
      ['nine'],
      ['ten'],
    ],
    ordinals: [
      ['first'],
      ['second'],
      ['third'],
      ['fourth'],
      ['fifth'],
      ['sixth'],
      ['seventh'],
      ['eighth'],
      ['ninth'],
      ['tenth'],
    ],
  },
  'pt-BR': {
    allow: ['permitir', 'permite', 'aprovar', 'aprova', 'aceitar', 'aceita'],
    deny: ['negar', 'nega', 'recusar', 'recusa', 'rejeitar', 'rejeita'],
    yes: ['sim', 'pode', 'pode enviar', 'enviar', 'envia', 'manda', 'confirmar', 'confirma', 'ok'],
    no: ['nao', 'cancelar', 'cancela', 'nao envia', 'deixa'],
    repeat: ['repetir', 'repete', 'de novo', 'fala de novo', 'como'],
    stop: ['parar', 'para', 'sair', 'sai', 'desligar', 'desliga'],
    option: ['opcao', 'numero', 'alternativa'],
    and: ['e', 'mais'],
    numbers: [
      ['um', 'uma'],
      ['dois', 'duas'],
      ['tres'],
      ['quatro'],
      ['cinco'],
      ['seis'],
      ['sete'],
      ['oito'],
      ['nove'],
      ['dez'],
    ],
    ordinals: [
      ['primeira', 'primeiro'],
      ['segunda', 'segundo'],
      ['terceira', 'terceiro'],
      ['quarta', 'quarto'],
      ['quinta', 'quinto'],
      ['sexta', 'sexto'],
      ['setima', 'setimo'],
      ['oitava', 'oitavo'],
      ['nona', 'nono'],
      ['decima', 'decimo'],
    ],
  },
  'es-ES': {
    allow: ['permitir', 'permite', 'aprobar', 'aprueba', 'aceptar', 'acepta'],
    deny: ['denegar', 'deniega', 'rechazar', 'rechaza', 'negar', 'niega'],
    yes: ['si', 'vale', 'envia', 'enviar', 'envialo', 'manda', 'confirmar', 'confirma', 'ok'],
    no: ['no', 'cancelar', 'cancela', 'no envies', 'deja'],
    repeat: ['repetir', 'repite', 'otra vez', 'de nuevo', 'como'],
    stop: ['parar', 'para', 'salir', 'sal', 'apagar', 'apaga'],
    option: ['opcion', 'numero', 'alternativa'],
    and: ['y', 'mas'],
    numbers: [
      ['uno', 'una'],
      ['dos'],
      ['tres'],
      ['cuatro'],
      ['cinco'],
      ['seis'],
      ['siete'],
      ['ocho'],
      ['nueve'],
      ['diez'],
    ],
    ordinals: [
      ['primera', 'primero'],
      ['segunda', 'segundo'],
      ['tercera', 'tercero'],
      ['cuarta', 'cuarto'],
      ['quinta', 'quinto'],
      ['sexta', 'sexto'],
      ['septima', 'septimo'],
      ['octava', 'octavo'],
      ['novena', 'noveno'],
      ['decima', 'decimo'],
    ],
  },
}
