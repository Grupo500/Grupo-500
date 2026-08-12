// Traducción del Event Calendar de ReUI.
//
// `locale: es` de date-fns solo traduce las FECHAS; los textos de la interfaz
// ("Today", "Month", "+N more"…) viven en esta prop aparte. Sin ella el
// calendario sale en inglés aunque las fechas estén en español.

import type { EventCalendarI18nOverrides } from '@/components/reui/event-calendar/event-calendar-i18n'

export const CALENDARIO_I18N: EventCalendarI18nOverrides = {
  labels: {
    today: 'Hoy',
    previous: 'Anterior',
    next: 'Siguiente',
    addEvent: 'Agregar contenido',
    allDay: 'Todo el día',
    more: count => `+${count} más`,
    noEvents: 'Nada programado',
    loading: 'Cargando contenido',
    event: 'contenido',
    events: count => (count === 1 ? '1 contenido' : `${count} contenidos`),
    selectView: 'Cambiar vista',
    week: n => `S${n}`,
    resources: 'Responsables',
    goToDate: 'Ir a una fecha',
    dropNotAllowed: 'Aquí no se puede',
    continues: 'continúa',
    timeFrom: hora => `Desde ${hora}`,
    timeUntil: hora => `Hasta ${hora}`,
    viewShortcuts: { month: 'M', week: 'S', day: 'D', days: '5', agenda: 'A', resource: 'R' },
    toggleDayEvents: count => (count === 1 ? '1 contenido' : `${count} contenidos`),
    eventDetails: titulo => titulo,
    moreCompact: count => `+${count}`,
    timeRange: (de, a) => `${de} – ${a}`,
  },
  viewNames: {
    month: 'Mes',
    week: 'Semana',
    day: 'Día',
    days: n => (n === 1 ? '1 día' : `${n} días`),
    agenda: 'Agenda',
    resource: 'Responsables',
  },
  formats: {
    // "Agosto de 2026" en vez de "agosto 2026": el nombre del mes se capitaliza
    // en formatTitle porque date-fns lo devuelve en minúscula en español.
    monthTitle: "MMMM 'de' yyyy",
    dayTitle: "EEEE d 'de' MMMM, yyyy",
    monthDayHeader: 'EEE',
    monthDayHeaderNarrow: 'EEEEE',
    timeGridDayHeader: 'EEE d',
    agendaDayHeader: "EEEE d 'de' MMMM",
    agendaDayNumber: 'd',
    agendaWeekday: 'EEE',
    moreDayHeader: "EEEE d 'de' MMMM",
    monthCellAriaLabel: 'PPPP',
    dayAria: 'PPPP',
  },
}
