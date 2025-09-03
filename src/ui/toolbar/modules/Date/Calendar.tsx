import { AnimatedPopover } from '@shared/components/AnimatedWrappers';
import { Icon } from '@shared/components/Icon';
import { useWindowFocusChange } from '@shared/hooks';
import { cx } from '@shared/styles';
import { Calendar, Row } from 'antd';
import { CalendarMode, HeaderRender } from 'antd/es/calendar/generateCalendar';
import moment from 'moment';
import { VNode } from 'preact';
import momentGenerateConfig from 'rc-picker/es/generate/moment';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import './infra.css';
import { BackgroundByLayersV2 } from '@shared/components/BackgroundByLayers/infra';

const short_week_days = {
  inner: ['Su', 'Mn', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
};

const MomentCalendar = Calendar.generateCalendar({
  ...momentGenerateConfig,
  locale: {
    ...momentGenerateConfig.locale,
    getShortWeekDays: () => short_week_days.inner,
  },
});

const DateCalendarHeader: HeaderRender<moment.Moment> = (props) => {
  const { type, value: date, onChange, onTypeChange } = props;

  if (type === 'month') {
    return (
      <Row className="calendar-header">
        <span className="calendar-date" onClick={() => onTypeChange('year')}>
          {date.format('MMMM YYYY')}
        </span>
        <div className="calendar-actions">
          <button
            className="calendar-navigator"
            onClick={() => onChange(date.clone().add(-1, 'months'))}
          >
            <Icon iconName="AiOutlineLeft" />
          </button>
          <button
            className="calendar-navigator"
            onClick={() => onChange(moment().locale(date.locale()))}
          >
            <Icon iconName="AiOutlineHome" />
          </button>
          <button
            className="calendar-navigator"
            onClick={() => onChange(date.clone().add(1, 'months'))}
          >
            <Icon iconName="AiOutlineRight" />
          </button>
        </div>
      </Row>
    );
  }

  return (
    <Row className="calendar-header">
      <span className="calendar-date" onClick={() => onTypeChange('month')}>
        {date.format('YYYY')}
      </span>
      <div className="calendar-actions">
        <div className="calendar-header-placeholder" />
        <button
          className="calendar-navigator"
          onClick={() => onChange(date.clone().add(-1, 'years'))}
        >
          <Icon iconName="AiOutlineLeft" />
        </button>
        <button
          className="calendar-navigator"
          onClick={() => onChange(moment().locale(date.locale()))}
        >
          <Icon iconName="AiOutlineHome" />
        </button>
        <button
          className="calendar-navigator"
          onClick={() => onChange(date.clone().add(1, 'years'))}
        >
          <Icon iconName="AiOutlineRight" />
        </button>
      </div>
    </Row>
  );
};

function DateCalendar() {
  const { i18n } = useTranslation();

  const [date, setDate] = useState(moment().locale(i18n.language));
  const [viewMode, setViewMode] = useState<CalendarMode | undefined>('month');
  const [events, setEvents] = useState<Record<string, any[]>>({});
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('gcal_token'),
  );
  const clientId = process.env.GCAL_CLIENT_ID;
  const tokenClientRef = useRef<any>();
  const handleAuth = () => {
    if (!clientId) {
      console.warn('GCAL_CLIENT_ID is not configured');
      return;
    }

    const initClient = () => {
      tokenClientRef.current = window.google?.accounts?.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/calendar.readonly',
        callback: (res: any) => {
          const access = res.access_token as string;
          localStorage.setItem('gcal_token', access);
          setToken(access);
        },
      });
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
    };

    if (tokenClientRef.current) {
      tokenClientRef.current.requestAccessToken({ prompt: 'consent' });
      return;
    }

    if (window.google?.accounts?.oauth2) {
      initClient();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = initClient;
    document.body.appendChild(script);
  };

  useEffect(() => {
    if (!token) {
      setEvents({});
      return;
    }

    async function fetchEvents() {
      try {
        const timeMin = date.clone().startOf('month').startOf('day').toISOString();
        const timeMax = date.clone().endOf('month').endOf('day').toISOString();
        const res = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(
            timeMin,
          )}&timeMax=${encodeURIComponent(timeMax)}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        const data = await res.json();
        const grouped: Record<string, any[]> = {};
        for (const item of data.items || []) {
          const when = item.start?.dateTime || item.start?.date;
          if (!when) continue;
          const key = moment(when).format('YYYY-MM-DD');
          if (!grouped[key]) {
            grouped[key] = [];
          }
          grouped[key]!.push(item);
        }
        setEvents(grouped);
      } catch (err) {
        console.error('Failed to load calendar events', err);
        setEvents({});
      }
    }

    fetchEvents();
  }, [token, date, i18n.language]);

  useEffect(() => {
    setDate(date.locale(i18n.language));
    const start = date.clone().startOf('isoWeek');
    short_week_days.inner = [
      start.day(0).format('dd'),
      start.day(1).format('dd'),
      start.day(2).format('dd'),
      start.day(3).format('dd'),
      start.day(4).format('dd'),
      start.day(5).format('dd'),
      start.day(6).format('dd'),
      start.day(7).format('dd'),
    ];
  }, [i18n.language]);

  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const isUp = e.deltaY < 0;
    setDate((date) =>
      date
        .clone()
        .startOf('month')
        .add(isUp ? 1 : -1, viewMode as moment.unitOfTime.Base),
    );
  }, []);

  return (
    <BackgroundByLayersV2
      className="calendar-container"
      prefix="calendar"
      onContextMenu={(e) => e.stopPropagation()}
    >
      {!token ? (
        <div className="calendar-auth">
          {clientId ? (
            <button className="calendar-auth-button" onClick={handleAuth}>
              Connect Google Calendar
            </button>
          ) : (
            <span className="calendar-auth-missing">
              Google Calendar unavailable
            </span>
          )}
        </div>
      ) : (
        <div onWheel={onWheel}>
          <MomentCalendar
            value={date}
            onChange={setDate}
            onPanelChange={(_, mode) => setViewMode(mode)}
            className="calendar"
            fullscreen={false}
            mode={viewMode}
            headerRender={DateCalendarHeader}
            fullCellRender={(current, info) =>
              info.type == 'date' ? (
                <div
                  className={cx('calendar-cell-value', {
                    'calendar-cell-selected': current.isSame(date, 'date'),
                    'calendar-cell-today': current.isSame(info.today, 'date'),
                    'calendar-cell-off-month': current.month() != date.month(),
                  })}
                  onClick={() => setDate(current)}
                >
                  {Number(current.format('DD'))}
                  {events[current.format('YYYY-MM-DD')] && (
                    <div className="calendar-event-indicator" />
                  )}
                </div>
              ) : (
                <div
                  className={cx('calendar-cell-value', 'calendar-cell-month', {
                    'calendar-cell-today': current
                      .startOf('month')
                      .isSame(info.today.startOf('month'), 'date'),
                  })}
                  onClick={() => {
                    setDate(current);
                    setViewMode('month');
                  }}
                >
                  {current.format('MMMM')}
                </div>
              )
            }
          />
          {(() => {
            const dayEvents = events[date.format('YYYY-MM-DD')] || [];
            return (
              dayEvents.length > 0 && (
                <ul className="calendar-events-list">
                  {dayEvents.map((ev) => (
                    <li key={ev.id || ev.summary}>{ev.summary}</li>
                  ))}
                </ul>
              )
            );
          })()}
        </div>
      )}
    </BackgroundByLayersV2>
  );
}

export function WithDateCalendar({ children }: { children: VNode }) {
  const [openPreview, setOpenPreview] = useState(false);

  useWindowFocusChange((focused) => {
    if (!focused) {
      setOpenPreview(false);
    }
  });

  return (
    <AnimatedPopover
      animationDescription={{
        openAnimationName: 'calendar-open',
        closeAnimationName: 'calendar-close',
      }}
      open={openPreview}
      trigger="click"
      onOpenChange={setOpenPreview}
      content={<DateCalendar />}
    >
      {children}
    </AnimatedPopover>
  );
}
