/// <reference types="@girs/gnome-shell/ambient" />
/// <reference types="@girs/gnome-shell/extensions/global" />

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Jalaali from './jalali.js';
import * as Events from './events.js';


let settings = null;

function formatMonthTitle(date) {
    const j = Jalaali.toJalaali(date);
    const pName = `${Jalaali.JALALI_MONTH_NAMES[j.jm - 1]} ${Jalaali.toPersianDigits(j.jy)}`;
    
    const GREGORIAN_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let s1Name = settings.get_boolean('show-gregorian-sub') ? `${GREGORIAN_MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}` : '';
    
    const LTR = '\u200E';
    const RTL = '\u200F';

    if (s1Name) {
        return `${LTR}${s1Name}${LTR} | ${RTL}${pName}${RTL}`;
    }
    return `${RTL}${pName}${RTL}`;
}

function hijackGNOMECalendar(cal) {
    if (cal._isJalaliHijacked) return;
    cal._isJalaliHijacked = true;

    cal._originalBuildHeader = cal._buildHeader;
    cal._originalRebuildCalendar = cal._rebuildCalendar;
    cal._originalUpdate = cal._update;

    cal._buildHeader = function() {
        const layout = this.layout_manager;
        
        // Scrub GNOME Shell's internal arrays to prevent "disposed object" crashes
        const currentChildren = this.get_children();
        for (let key of Object.keys(this)) {
            if (Array.isArray(this[key]) && this[key].length > 0) {
                let hasOldChild = this[key].some(item => 
                    currentChildren.includes(item) || (item && typeof item === 'object' && currentChildren.includes(item.button))
                );
                if (hasOldChild) {
                    this[key] = [];
                }
            }
        }
        this['_buttons'] = [];
        if (this._dates) this._dates = [];

        // Safely unparent children before destroying to prevent lingering C++ references
        currentChildren.forEach(child => this.remove_child(child));

        const topBox = new St.BoxLayout({style_class: 'calendar-month-header'});
        layout.attach(topBox, 0, 0, 7, 1);

        const backButton = new St.Button({ style_class: 'calendar-change-month-back pager-button', icon_name: 'pan-start-symbolic', can_focus: true });
        topBox.add_child(backButton);
        backButton.connectObject('clicked', () => {
            let j = Jalaali.toJalaali(this._selectedDate || new Date());
            let m = j.jm - 1; let y = j.jy;
            if (m === 0) { m = 12; y--; }
            const g = Jalaali.toGregorian(y, m, 1);
            this.setDate(new Date(g.gy, g.gm - 1, g.gd));
        });

        const customFont = settings ? settings.get_string('custom-font') : 'Vazirmatn';
        let fontStr = customFont ? `${customFont}, ` : '';
        let styleStr = `font-family: ${fontStr}Vazirmatn, sans-serif;`;

        this['_monthLabel'] = new St.Label({ style_class: 'calendar-month-label', can_focus: true, x_align: Clutter.ActorAlign.FILL, x_expand: true, y_align: Clutter.ActorAlign.CENTER });
        this['_monthLabel'].clutter_text.ellipsize = 3; // Pango.EllipsizeMode.END
        this['_monthLabel'].clutter_text.line_alignment = 1; // Pango.Alignment.CENTER
        this['_monthLabel'].set_style(styleStr + 'font-size: 0.85em; font-stretch: condensed; font-weight: normal; padding: 0; margin: 0;');
        topBox.add_child(this['_monthLabel']);

        const forwardButton = new St.Button({ style_class: 'calendar-change-month-forward pager-button', icon_name: 'pan-end-symbolic', can_focus: true });
        topBox.add_child(forwardButton);
        forwardButton.connectObject('clicked', () => {
            let j = Jalaali.toJalaali(this._selectedDate || new Date());
            let m = j.jm + 1; let y = j.jy;
            if (m === 13) { m = 1; y++; }
            const g = Jalaali.toGregorian(y, m, 1);
            this.setDate(new Date(g.gy, g.gm - 1, g.gd));
        });

        const weekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
        for (let i = 0; i < 7; i++) {
            const label = new St.Label({ style_class: 'calendar-day-heading', text: weekDays[i], can_focus: true });
            label.set_style(styleStr);
            layout.attach(label, 6 - i, 1, 1, 1);
        }

        this._firstDayIndex = this.get_n_children();
    };

    cal._rebuildCalendar = function() {
        const now = new Date();
        const children = this.get_children();
        
        for (let i = this._firstDayIndex; i < children.length; i++) {
            this.remove_child(children[i]);
        }

        this['_buttons'] = [];
        if (this._dates) this._dates = [];
        
        let targetDate = this._selectedDate || now;
        let targetJ = Jalaali.toJalaali(targetDate);
        this._builtMonth = targetJ.jm;
        this._builtYear = targetJ.jy;
        
        let firstDayG = Jalaali.toGregorian(targetJ.jy, targetJ.jm, 1);
        let firstDay = new Date(firstDayG.gy, firstDayG.gm - 1, firstDayG.gd);
        
        const monthLength = Jalaali.jalaaliMonthLength(targetJ.jy, targetJ.jm);
        let firstDayOfWeek = firstDay.getDay() + 1; // 0 is Saturday
        if (firstDayOfWeek === 7) firstDayOfWeek = 0;

        this._calendarBegin = firstDay;
        this._markedAsToday = now;

        const layout = this.layout_manager;
        let row = 2;
        let col = firstDayOfWeek;

        const customFont = settings.get_string('custom-font') || 'Vazirmatn';
        const colorToday = settings.get_string('color-today') || '#3584e4';
        const colorHoliday = settings.get_string('color-holiday') || '#ed333b';
        const colorDay = settings.get_string('color-day') || '#ffffff';
        
        const enableCustomColorToday = settings.get_boolean('enable-custom-color-today');
        const enableCustomColorHoliday = settings.get_boolean('enable-custom-color-holiday');
        const enableCustomColorDay = settings.get_boolean('enable-custom-color-day');
        const eventOptions = {
            iranian: settings.get_boolean('show-events-iranian'),
            hijri: settings.get_boolean('show-events-hijri'),
            gregorian: settings.get_boolean('show-events-gregorian')
        };

        for (let day = 1; day <= monthLength; day++) {
            const gDate = Jalaali.toGregorian(targetJ.jy, targetJ.jm, day);
            const iter = new Date(gDate.gy, gDate.gm - 1, gDate.gd);
            const hDate = Jalaali.toHijri(iter);

            const _calBtn = new St.Button({
                can_focus: true,
                style_class: 'calendar-day'
            });

            // Create tile content
            const wrapper = new St.BoxLayout({ vertical: true, x_align: Clutter.ActorAlign.FILL, y_align: Clutter.ActorAlign.CENTER, y_expand: true });

            const tileBox = new St.BoxLayout({ vertical: true, x_align: Clutter.ActorAlign.FILL, style_class: 'calendar-tile-box' });
            
            const mainLabel = new St.Label({
                text: Jalaali.toPersianDigits(day),
                style_class: 'calendar-tile-main',
                x_align: Clutter.ActorAlign.CENTER
            });
            let fontStr = customFont ? `${customFont}, ` : '';
            let styleStr = `font-family: ${fontStr}Vazirmatn, sans-serif;`;
            mainLabel.set_style(styleStr);
            tileBox.add_child(mainLabel);

            const subsBox = new St.BoxLayout({ style_class: 'calendar-tile-subs', x_expand: true });
            
            const subStyleStr = `${styleStr} color: #d3d3d3;`;
            
            const hijriLabel = new St.Label({ text: '', style_class: 'calendar-tile-sub-hijri', x_align: Clutter.ActorAlign.START, x_expand: true });
            hijriLabel.set_style(subStyleStr);
            
            const pipeLabel = new St.Label({ text: ' | ', style_class: 'calendar-tile-sub-pipe', x_align: Clutter.ActorAlign.CENTER, x_expand: true });
            pipeLabel.set_style(subStyleStr);
            
            const gregLabel = new St.Label({ text: '', style_class: 'calendar-tile-sub-gregorian', x_align: Clutter.ActorAlign.END, x_expand: true });
            gregLabel.set_style(subStyleStr);
            
            let hasHijri = settings.get_boolean('show-hijri');
            let hasGreg = settings.get_boolean('show-gregorian-sub');
            
            if (hasHijri) hijriLabel.text = Jalaali.toArabicDigits(hDate.jd);
            if (hasGreg) gregLabel.text = iter.getDate().toString();
            if (!hasHijri || !hasGreg) pipeLabel.text = '';

            subsBox.add_child(hijriLabel);
            subsBox.add_child(pipeLabel);
            subsBox.add_child(gregLabel);
            
            tileBox.add_child(subsBox);
            wrapper.add_child(tileBox);

            const eventLine = new St.Widget({ height: 2, width: 18, style_class: 'calendar-event-line', x_expand: false, x_align: Clutter.ActorAlign.CENTER });
            wrapper.add_child(eventLine);

            _calBtn.set_child(wrapper);

            _calBtn._date = new Date(iter);
            _calBtn.connectObject('clicked', () => {
                this._shouldDateGrabFocus = true;
                this.setDate(_calBtn._date);
                this._shouldDateGrabFocus = false;
            });

            let styleClass = 'calendar-day';
            if (col === 6) styleClass += ' calendar-weekend';
            else styleClass += ' calendar-weekday';

            if (row === 2) styleClass = `calendar-day-top ${styleClass}`;
            if (6 - col === 0) styleClass = `calendar-day-left ${styleClass}`;

            const isToday = iter.getFullYear() === now.getFullYear() && iter.getMonth() === now.getMonth() && iter.getDate() === now.getDate();
            if (isToday) {
                styleClass += ' calendar-today';
            }

            const events = Events.getEventsForDate(iter, eventOptions, { 
                j: { jy: targetJ.jy, jm: targetJ.jm, jd: day }, 
                h: hDate 
            });
            const isWeekend = col === 6;
            const isHoliday = events.some(e => e.isHoliday) || isWeekend;

            if (events.length > 0 || isHoliday) {
                eventLine.opacity = 255;
            } else {
                eventLine.opacity = 0;
            }
            
            if (isToday && enableCustomColorToday) {
                _calBtn.set_style(`background-color: ${colorToday}; border-radius: 999px;`);
                mainLabel.set_style(`font-family: ${fontStr}Vazirmatn, sans-serif; color: white;`);
                hijriLabel.set_style(`font-family: ${fontStr}Vazirmatn, sans-serif; color: rgba(255,255,255,0.7);`);
                pipeLabel.set_style(`font-family: ${fontStr}Vazirmatn, sans-serif; color: rgba(255,255,255,0.7);`);
                gregLabel.set_style(`font-family: ${fontStr}Vazirmatn, sans-serif; color: rgba(255,255,255,0.7);`);
            } else {
                if (isHoliday && enableCustomColorHoliday) {
                    eventLine.set_style(`background-color: ${colorHoliday};`);
                    mainLabel.set_style(`font-family: ${fontStr}Vazirmatn, sans-serif; color: ${colorHoliday};`);
                } else if (enableCustomColorDay) {
                    mainLabel.set_style(`font-family: ${fontStr}Vazirmatn, sans-serif; color: ${colorDay};`);
                }
            }

            _calBtn.style_class = styleClass;

            layout.attach(_calBtn, 6 - col, row, 1, 1);
            this['_buttons'].push(_calBtn);

            col++;
            if (col > 6) {
                col = 0;
                row++;
            }
        }
        
        if (this._eventSource) {
            this._eventSource.requestRange(firstDay, new Date(firstDay.getTime() + (monthLength + 1) * 86400000));
        }
    };

    cal._update = function() {
        const now = new Date();
        const targetDate = this._selectedDate || now;
        
        const customFont = settings ? settings.get_string('custom-font') : 'Vazirmatn';
        let fontStr = customFont ? `${customFont}, ` : '';
        let styleStr = `font-family: ${fontStr}Vazirmatn, sans-serif;`;
        
        this._monthLabel.text = formatMonthTitle(targetDate);
        this._monthLabel.set_style(styleStr + 'font-size: 0.85em; font-stretch: condensed; font-weight: normal; padding: 0; margin: 0;');

        let targetJ = Jalaali.toJalaali(targetDate);
        if (!this._builtMonth || this._builtMonth !== targetJ.jm || this._builtYear !== targetJ.jy || !this._markedAsToday || this._markedAsToday.getDate() !== now.getDate()) {
            this._buildHeader();
            this._rebuildCalendar();
        }

        this._buttons.forEach(button => {
            if (button._date.getFullYear() === (this._selectedDate || now).getFullYear() &&
                button._date.getMonth() === (this._selectedDate || now).getMonth() &&
                button._date.getDate() === (this._selectedDate || now).getDate()) {
                button.add_style_pseudo_class('selected');
                if (this._shouldDateGrabFocus) button.grab_key_focus();
            } else {
                button.remove_style_pseudo_class('selected');
            }
            
            const eventOptions = {
                iranian: settings ? settings.get_boolean('show-events-iranian') : true,
                hijri: settings ? settings.get_boolean('show-events-hijri') : true,
                gregorian: settings ? settings.get_boolean('show-events-gregorian') : true
            };
            const myHolidays = Events.getEventsForDate(button._date, eventOptions);
            const hasJalaliEvents = myHolidays && myHolidays.length > 0;
            const hasGregorianEvents = this._eventSource.hasEvents(button._date);
            
            if (hasJalaliEvents || hasGregorianEvents) {
                button.add_style_class_name('has-events');
            } else {
                button.remove_style_class_name('has-events');
            }
        });
    };

    cal._buildHeader();
    cal._rebuildCalendar();
    cal._update();
}

function restoreGNOMECalendar(cal) {
    if (!cal || !cal._isJalaliHijacked) return;
    cal._isJalaliHijacked = false;
    
    if (cal._backButton) { cal._backButton.destroy(); cal._backButton = null; }
    if (cal._forwardButton) { cal._forwardButton.destroy(); cal._forwardButton = null; }
    if (cal._monthLabel) { cal._monthLabel.destroy(); cal._monthLabel = null; }
    if (cal._topBox) { cal._topBox.destroy(); cal._topBox = null; }
    if (cal._buttons) { cal._buttons = null; }
    
    cal._buildHeader = cal._originalBuildHeader;
    cal._rebuildCalendar = cal._originalRebuildCalendar;
    cal._update = cal._originalUpdate;
    
    cal._buildHeader();
    cal._rebuildCalendar();
    cal._update();
}

function hijackEventsSection(eventsItem) {
    if (!eventsItem || eventsItem._isJalaliHijacked) return;
    eventsItem._isJalaliHijacked = true;

    eventsItem._originalReloadEvents = eventsItem._reloadEvents;
    eventsItem._originalSetDate = eventsItem.setDate;
    eventsItem._originalUpdateTitle = eventsItem._updateTitle;

    eventsItem._updateTitle = function() {
        if (this._originalUpdateTitle) {
            this._originalUpdateTitle();
        }
        
        if (this._title && this._startDate) {
            const date = this._startDate;
            const j = Jalaali.toJalaali(date);
            const rle = '\u202B';
            const pdf = '\u202C';
            const pDate = `${rle}${Jalaali.toPersianDigits(j.jd)} ${Jalaali.JALALI_MONTH_NAMES[j.jm - 1]}${pdf}`;
            const lrm = '\u200E';
            
            let newText = '';
            if (settings && settings.get_boolean('show-gregorian-sub')) {
                const gDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
                newText = `${lrm}${gDate} ${lrm}|${lrm} ${pDate}`;
            } else {
                newText = pDate;
            }
            
            if (settings && settings.get_boolean('show-hijri')) {
                const hDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-arab', {
                    day: 'numeric', month: 'long'
                }).format(date);
                newText += ` ${lrm}|${lrm} ${rle}${hDate}${pdf}`;
            }
            
            const customFont = settings ? settings.get_string('custom-font') : 'Vazirmatn';
            let fontStr = customFont ? `"${customFont}", ` : '';
            this._title.set_style(`font-family: ${fontStr}Vazirmatn, sans-serif; font-weight: bold;`);
            
            this._title.set_text_direction(Clutter.TextDirection.LTR);
            this._title.set_text(newText);
            this._title.x_align = Clutter.ActorAlign.CENTER;
        }
    };

    eventsItem.setDate = function(date) {
        this._originalSetDate(date);
        this._updateTitle();
    };

    if (eventsItem._eventsList && !eventsItem._eventsList._originalAddChild) {
        eventsItem._eventsList._originalAddChild = eventsItem._eventsList.add_child;
        eventsItem._eventsList.add_child = function(child) {
            if (child.has_style_class_name && child.has_style_class_name('event-placeholder') && eventsItem._startDate) {
                const eventOptions = {
                    iranian: settings.get_boolean('show-events-iranian'),
                    hijri: settings.get_boolean('show-events-hijri'),
                    gregorian: settings.get_boolean('show-events-gregorian')
                };
                const myHolidays = Events.getEventsForDate(eventsItem._startDate, eventOptions);
                if (myHolidays && myHolidays.length > 0) {
                    return; // Block the placeholder!
                }
            }
            
            if (child.event && child.event.summary) {
                if (/^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(child.event.summary)) {
                    child.set_text_direction(Clutter.TextDirection.RTL);
                }
            }
            
            this._originalAddChild(child);
        };
    }

    eventsItem._originalReloadEvents = eventsItem._reloadEvents;
    eventsItem._reloadEvents = async function() {
        if (this._originalReloadEvents) {
            await this._originalReloadEvents();
        }
        if (this._isJalaliHijacked) injectHolidays(this);
    };

    if (eventsItem.reloadEvents) {
        eventsItem._originalPublicReloadEvents = eventsItem.reloadEvents;
        eventsItem.reloadEvents = async function() {
            if (this._originalPublicReloadEvents) {
                await this._originalPublicReloadEvents();
            }
            if (this._isJalaliHijacked) injectHolidays(this);
        };
    }

    if (eventsItem.updateEvents) {
        eventsItem._originalPublicUpdateEvents = eventsItem.updateEvents;
        eventsItem.updateEvents = async function() {
            if (this._originalPublicUpdateEvents) {
                await this._originalPublicUpdateEvents();
            }
            if (this._isJalaliHijacked) injectHolidays(this);
        };
    }

    if (eventsItem._sync) {
        eventsItem._originalSync = eventsItem._sync;
        eventsItem._sync = function() {
            if (this._originalSync) this._originalSync();
            if (this._isJalaliHijacked) injectHolidays(this);
        };
    }

    if (eventsItem.sync) {
        eventsItem._originalPublicSync = eventsItem.sync;
        eventsItem.sync = function() {
            if (this._originalPublicSync) this._originalPublicSync();
            if (this._isJalaliHijacked) injectHolidays(this);
        };
    }
}

function injectHolidays(eventsItem) {
    if (!settings || !eventsItem || !eventsItem._eventsList) return;
    
    const rtlRegex = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    
    const children = eventsItem._eventsList.get_children();
    
    // Remove existing injected holidays
    children.forEach(child => {
        if (child.has_style_class_name('jalali-event-box')) {
            child.destroy();
        }
    });
    
    const eventOptions = {
        iranian: settings.get_boolean('show-events-iranian'),
        hijri: settings.get_boolean('show-events-hijri'),
        gregorian: settings.get_boolean('show-events-gregorian')
    };
    
    const myHolidays = Events.getEventsForDate(eventsItem._startDate, eventOptions);
    if (myHolidays.length === 0) return;
    
    // Remove the placeholder if there are holidays
    eventsItem._eventsList.get_children().forEach(child => {
        if (child.has_style_class_name && child.has_style_class_name('event-placeholder')) {
            eventsItem._eventsList.remove_child(child);
        }
    });
    
    const enableCustomColorHoliday = settings.get_boolean('enable-custom-color-holiday');
    const enableCustomColorDay = settings.get_boolean('enable-custom-color-day');
    const colorHoliday = settings.get_string('color-holiday') || '#ed333b';
    const colorDay = settings.get_string('color-day') || '#ffffff';
    const customFont = settings.get_string('custom-font') || 'Vazirmatn';
    let fontStr = customFont ? `"${customFont}", ` : '';
    
    for (let i = myHolidays.length - 1; i >= 0; i--) {
        const h = myHolidays[i];
        const box = new St.BoxLayout({
            style_class: 'jalali-event-box',
            orientation: Clutter.Orientation.VERTICAL,
            x_expand: true,
        });
        
        let useColor = false;
        let eventColor = '';
        if (enableCustomColorHoliday && h.isHoliday) {
            useColor = true;
            eventColor = colorHoliday;
        } else if (enableCustomColorDay && !h.isHoliday) {
            useColor = true;
            eventColor = colorDay;
        }
        
        const isRTL = rtlRegex.test(h.title);
        const textDir = isRTL ? Clutter.TextDirection.RTL : Clutter.TextDirection.LTR;
        const alignDir = isRTL ? Clutter.ActorAlign.END : Clutter.ActorAlign.START;
        
        box.set_text_direction(textDir);

        const titleLabel = new St.Label({
            text: h.title,
            style_class: 'event-title',
            x_expand: true,
            x_align: alignDir
        });
        titleLabel.set_text_direction(textDir);
        let titleStyle = `font-family: ${fontStr}Vazirmatn, sans-serif; font-weight: bold;`;
        if (useColor) {
            titleStyle += ` color: ${eventColor};`;
        }
        titleLabel.set_style(titleStyle);
        box.add_child(titleLabel);
        
        const timeLabel = new St.Label({
            text: h.isHoliday ? 'تعطیل رسمی' : 'مناسبت',
            style_class: 'event-time',
            x_expand: true,
            x_align: alignDir
        });
        timeLabel.set_text_direction(textDir);
        timeLabel.set_style(`font-family: ${fontStr}Vazirmatn, sans-serif;`);
            timeLabel.add_style_class_name('dim-label');
        box.add_child(timeLabel);
        
        eventsItem._eventsList.insert_child_at_index(box, 0);
    }
    
    if (eventsItem._eventsList) {
        eventsItem._eventsList.visible = true;
        eventsItem._eventsList.show();
        eventsItem._eventsList.queue_relayout();
    }
    if (eventsItem) {
        eventsItem.visible = true;
        eventsItem.show();
        eventsItem.queue_relayout();
    }
}

function restoreEventsSection(eventsItem) {
    if (!eventsItem || !eventsItem._isJalaliHijacked) return;
    eventsItem._isJalaliHijacked = false;
    
    if (eventsItem._eventsList && eventsItem._eventsList._originalAddChild) {
        eventsItem._eventsList.add_child = eventsItem._eventsList._originalAddChild;
        eventsItem._eventsList._originalAddChild = null;
    }
    
    eventsItem._reloadEvents = eventsItem._originalReloadEvents;
    
    if (eventsItem._originalSetDate) {
        eventsItem.setDate = eventsItem._originalSetDate;
    }
    
    if (eventsItem._originalUpdateTitle) {
        eventsItem._updateTitle = eventsItem._originalUpdateTitle;
    }
}

function hijackTodayButton(todayButton) {
    if (!todayButton || todayButton._isJalaliHijacked) return;
    todayButton._isJalaliHijacked = true;

    if (!todayButton._gridWidget && todayButton._dayLabel && todayButton._dateLabel) {
        let vbox = todayButton._dayLabel.get_parent();
        if (vbox) {
            vbox.remove_child(todayButton._dayLabel);
            vbox.remove_child(todayButton._dateLabel);
            
            todayButton._gridWidget = new St.Widget({ x_expand: true });
            let grid = new Clutter.GridLayout();
            todayButton._gridWidget.layout_manager = grid;
            
            todayButton._dayLabel.x_expand = true;
            todayButton._dayLabel.x_align = Clutter.ActorAlign.START;
            todayButton._dayPipe = new St.Label({ text: '', x_expand: false, x_align: Clutter.ActorAlign.CENTER, style_class: 'calendar-tile-sub-pipe' });
            todayButton._dayJalali = new St.Label({ text: '', x_expand: true, x_align: Clutter.ActorAlign.END, style_class: 'day-label' });
            
            todayButton._dateLabel.x_expand = true;
            todayButton._dateLabel.x_align = Clutter.ActorAlign.START;
            todayButton._datePipe = new St.Label({ text: '', x_expand: false, x_align: Clutter.ActorAlign.CENTER, style_class: 'calendar-tile-sub-pipe' });
            todayButton._dateJalali = new St.Label({ text: '', x_expand: true, x_align: Clutter.ActorAlign.END, style_class: 'date-label' });
            
            // Add margin to pipes for breathing room
            todayButton._dayPipe.set_style('margin: 0 10px;');
            todayButton._datePipe.set_style('margin: 0 10px;');

            grid.attach(todayButton._dayLabel, 0, 0, 1, 1);
            grid.attach(todayButton._dayPipe, 1, 0, 1, 1);
            grid.attach(todayButton._dayJalali, 2, 0, 1, 1);
            
            grid.attach(todayButton._dateLabel, 0, 1, 1, 1);
            grid.attach(todayButton._datePipe, 1, 1, 1, 1);
            grid.attach(todayButton._dateJalali, 2, 1, 1, 1);
            
            vbox.add_child(todayButton._gridWidget);
        }
    }

    todayButton._originalSetDate = todayButton.setDate;
    todayButton.setDate = function(date) {
        this._originalSetDate(date);
        
        const customFont = settings ? settings.get_string('custom-font') : 'Vazirmatn';
        let fontStr = customFont ? `${customFont}, ` : '';
        let styleStr = `font-family: ${fontStr}Vazirmatn, sans-serif;`;
        
        const j = Jalaali.toJalaali(date);
        const pName = `${Jalaali.JALALI_WEEK_DAYS[(date.getDay() + 1) % 7]}`;
        const pDate = `${Jalaali.toPersianDigits(j.jd)} ${Jalaali.JALALI_MONTH_NAMES[j.jm - 1]} ${Jalaali.toPersianDigits(j.jy)}`;
        
        if (this._dayJalali) {
            this._dayJalali.set_text(pName);
            this._dayJalali.set_style(styleStr);
        }
        if (this._dateJalali) {
            this._dateJalali.set_text(pDate);
            this._dateJalali.set_style(styleStr);
        }
        if (this._dayPipe) this._dayPipe.set_style(`margin: 0 10px; ${styleStr}`);
        if (this._datePipe) this._datePipe.set_style(`margin: 0 10px; ${styleStr}`);
    };
    
    todayButton.setDate(new Date());
}

function restoreTodayButton(todayButton) {
    if (!todayButton || !todayButton._isJalaliHijacked) return;
    todayButton._isJalaliHijacked = false;
    todayButton.setDate = todayButton._originalSetDate;
    
    if (todayButton._gridWidget) {
        let vbox = todayButton._gridWidget.get_parent();
        if (vbox) {
            vbox.remove_child(todayButton._gridWidget);
            
            todayButton._gridWidget.remove_child(todayButton._dayLabel);
            todayButton._gridWidget.remove_child(todayButton._dateLabel);
            
            vbox.add_child(todayButton._dayLabel);
            vbox.add_child(todayButton._dateLabel);
        }
        todayButton._gridWidget.destroy();
        todayButton._gridWidget = null;
    }
    
    todayButton.setDate(new Date());
}

function updateTopIndicator(clockDisplay) {
    if (clockDisplay._isUpdatingClock) return;
    clockDisplay._isUpdatingClock = true;

    const originalText = clockDisplay._dateMenu ? clockDisplay._dateMenu._clock.clock : clockDisplay.text;
    if (!originalText) {
        clockDisplay._isUpdatingClock = false;
        return;
    }

    const now = new Date();
    const j = Jalaali.toJalaali(now);
    const weekdayName = Jalaali.JALALI_WEEK_DAYS[(now.getDay() + 1) % 7];
    let pStr = `${weekdayName} ${Jalaali.toPersianDigits(j.jd)} ${Jalaali.JALALI_MONTH_NAMES[j.jm - 1]}`;

    let separator = '';
    if (originalText.includes('\u2002')) separator = '\u2002';
    else if (originalText.includes('\u2003')) separator = '\u2003';
    else if (originalText.includes('  ')) separator = '  ';

    const LTR = '\u200E';
    const RTL = '\u200F';

    if (separator) {
        let parts = originalText.split(separator);
        clockDisplay.text = `${LTR}${parts[0]}${LTR} | ${RTL}${pStr}${RTL}${separator}${LTR}${parts.slice(1).join(separator)}${LTR}`;
    } else {
        clockDisplay.text = `${RTL}${pStr}${RTL} | ${LTR}${originalText}${LTR}`;
    }

    const customFont = settings ? settings.get_string('custom-font') : 'Vazirmatn';
    let fontStr = customFont ? `${customFont}, ` : '';
    clockDisplay.set_style(`font-family: ${fontStr}Vazirmatn, sans-serif;`);

    clockDisplay._isUpdatingClock = false;
}



function copyDir(fromDir, toDir) {
    let children = fromDir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
    if (!toDir.query_exists(null)) {
        toDir.make_directory_with_parents(null);
    }

    let info, child, type;
    while ((info = children.next_file(null)) !== null) {
        type = info.get_file_type();
        child = fromDir.get_child(info.get_name());
        if (type === Gio.FileType.REGULAR) {
            child.copy(toDir.get_child(child.get_basename()), 0, null, null);
        } else if (type === Gio.FileType.DIRECTORY) {
            copyDir(child, toDir.get_child(child.get_basename()));
        }
    }
}

function deleteDir(dir) {
    let children = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
    let info, child, type;
    while ((info = children.next_file(null)) !== null) {
        type = info.get_file_type();
        child = dir.get_child(info.get_name());
        if (type === Gio.FileType.REGULAR) {
            child.delete(null);
        } else if (type === Gio.FileType.DIRECTORY) {
            deleteDir(child);
        }
    }
    dir.delete(null);
}

export default class JalaliCalendarExtension extends Extension {
    enable() {
        this.install_fonts();

        settings = this.getSettings();
        this._dateMenu = Main.panel.statusArea.dateMenu;
        
        if (this._dateMenu._calendar) {
            hijackGNOMECalendar(this._dateMenu._calendar);
        }
        
        if (this._dateMenu._eventsItem) {
            hijackEventsSection(this._dateMenu._eventsItem);
        }

        if (this._dateMenu._date) {
            hijackTodayButton(this._dateMenu._date);
        }

        if (this._dateMenu._clockDisplay) {
            this._dateMenu._clockDisplay._dateMenu = this._dateMenu;
            this._dateMenu._clockDisplay.add_style_class_name('jalali-clock-display');
            this._dateMenu._clockDisplay.connectObject('notify::text', () => {
                updateTopIndicator(this._dateMenu._clockDisplay);
            }, this);
            // trigger it once initially
            updateTopIndicator(this._dateMenu._clockDisplay);
        }

        settings.connectObject('changed', () => {
            if (this._dateMenu._calendar && this._dateMenu._calendar._isJalaliHijacked) {
                this._dateMenu._calendar._buildHeader();
                this._dateMenu._calendar._rebuildCalendar();
                this._dateMenu._calendar._update();
            }
            if (this._dateMenu._date && this._dateMenu._date._isJalaliHijacked) {
                this._dateMenu._date.setDate(new Date());
            }
            if (this._dateMenu._clockDisplay) {
                updateTopIndicator(this._dateMenu._clockDisplay);
            }
            if (this._dateMenu._eventsItem && this._dateMenu._eventsItem._isJalaliHijacked) {
                this._dateMenu._eventsItem._reloadEvents();
            }
        }, this);
    }

    disable() {
        if (settings) {
            settings.disconnectObject(this);
        }

        if (this._dateMenu && this._dateMenu._calendar) {
            restoreGNOMECalendar(this._dateMenu._calendar);
        }
        
        if (this._dateMenu && this._dateMenu._eventsItem) {
            restoreEventsSection(this._dateMenu._eventsItem);
        }

        if (this._dateMenu && this._dateMenu._date) {
            restoreTodayButton(this._dateMenu._date);
        }

        if (this._dateMenu && this._dateMenu._clockDisplay) {
            this._dateMenu._clockDisplay.remove_style_class_name('jalali-clock-display');
            this._dateMenu._clockDisplay.disconnectObject(this);
            // Restore original text
            if (this._dateMenu._clock) {
                this._dateMenu._clockDisplay.text = this._dateMenu._clock.clock;
            }
        }

        this._dateMenu = null;
        settings = null;

        this.uninstall_fonts();
    }

    install_fonts() {
        const homePath = GLib.get_home_dir();
        const dst = Gio.file_new_for_path(`${homePath}/.local/share/fonts/jalali-calender-fonts/`);
        if (!dst.query_exists(null)) {
            const src = Gio.file_new_for_path(`${this.path}/assets/fonts`);
            copyDir(src, dst);
        }
    }

    uninstall_fonts() {
        const homePath = GLib.get_home_dir();
        const isLocked = Main.sessionMode.currentMode === 'unlock-dialog';
        const dir = Gio.file_new_for_path(`${homePath}/.local/share/fonts/jalali-calender-fonts/`);
        if (dir.query_exists(null) && !isLocked) {
            deleteDir(dir);
        }
    }
    
}

