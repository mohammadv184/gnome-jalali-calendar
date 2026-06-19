import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class JalaliCalendarPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        
        const popupGroup = new Adw.PreferencesGroup({
            title: 'Calendar Settings',
            description: 'Configure the calendar dashboard appearance'
        });

        // Show Hijri
        const hijriRow = new Adw.SwitchRow({
            title: 'Show Hijri Date',
            subtitle: 'Display Islamic Hijri dates as secondary'
        });
        settings.bind('show-hijri', hijriRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        popupGroup.add(hijriRow);

        // Show Gregorian
        const gregRow = new Adw.SwitchRow({
            title: 'Show Gregorian Date',
            subtitle: 'Display Gregorian dates as secondary'
        });
        settings.bind('show-gregorian-sub', gregRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        popupGroup.add(gregRow);

        page.add(popupGroup);
        window.add(page);
    }
}
