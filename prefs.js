import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import Gdk from 'gi://Gdk';
import Pango from 'gi://Pango';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { VERSION } from './config.js';

export default class JalaliCalendarPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        // --- 1. Appearance Page ---
        const appPage = new Adw.PreferencesPage({
            title: 'Appearance',
            icon_name: 'preferences-desktop-appearance-symbolic'
        });

        const fontGroup = new Adw.PreferencesGroup({ title: 'Typography' });
        const fontRow = new Adw.ActionRow({ title: 'Font', subtitle: 'Choose a font for the calendar' });
        const fontBtn = new Gtk.FontButton({ valign: Gtk.Align.CENTER });
        fontBtn.set_level(Gtk.FontChooserLevel.FAMILY);
        fontBtn.set_font(settings.get_string('custom-font') || 'Vazirmatn');
        fontBtn.connect('font-set', () => {
            let desc = Pango.FontDescription.from_string(fontBtn.get_font());
            settings.set_string('custom-font', desc.get_family());
        });
        fontRow.add_suffix(fontBtn);
        fontRow.activatable_widget = fontBtn;
        fontGroup.add(fontRow);
        appPage.add(fontGroup);

        const colorsGroup = new Adw.PreferencesGroup({ title: 'Colors' });
        
        const todayColorRow = new Adw.ActionRow({ title: 'Today Color' });
        const todayColorBtn = new Gtk.ColorButton({ valign: Gtk.Align.CENTER });
        const rgbaToday = new Gdk.RGBA();
        rgbaToday.parse(settings.get_string('color-today') || '#3584e4');
        todayColorBtn.set_rgba(rgbaToday);
        todayColorBtn.connect('color-set', () => {
            settings.set_string('color-today', todayColorBtn.get_rgba().to_string());
        });
        const todayToggle = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind('enable-custom-color-today', todayToggle, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('enable-custom-color-today', todayColorBtn, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
        todayColorRow.add_suffix(todayColorBtn);
        todayColorRow.add_suffix(todayToggle);
        todayColorRow.activatable_widget = todayToggle;
        colorsGroup.add(todayColorRow);

        // Day Color
        const colorDayRow = new Adw.ActionRow({ title: 'Day Color' });
        const colorDayButton = new Gtk.ColorButton({ valign: Gtk.Align.CENTER });
        const rgbaDay = new Gdk.RGBA();
        rgbaDay.parse(settings.get_string('color-day') || '#ffffff');
        colorDayButton.set_rgba(rgbaDay);
        colorDayButton.connect('color-set', () => {
            settings.set_string('color-day', colorDayButton.get_rgba().to_string());
        });
        const colorDaySwitch = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind('enable-custom-color-day', colorDaySwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('enable-custom-color-day', colorDayButton, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
        colorDayRow.add_suffix(colorDayButton);
        colorDayRow.add_suffix(colorDaySwitch);
        colorDayRow.activatable_widget = colorDaySwitch;
        colorsGroup.add(colorDayRow);

        const holidayColorRow = new Adw.ActionRow({ title: 'Holiday Color' });
        const holidayColorBtn = new Gtk.ColorButton({ valign: Gtk.Align.CENTER });
        const rgbaHol = new Gdk.RGBA();
        rgbaHol.parse(settings.get_string('color-holiday') || '#ed333b');
        holidayColorBtn.set_rgba(rgbaHol);
        holidayColorBtn.connect('color-set', () => {
            settings.set_string('color-holiday', holidayColorBtn.get_rgba().to_string());
        });
        const holToggle = new Gtk.Switch({ valign: Gtk.Align.CENTER });
        settings.bind('enable-custom-color-holiday', holToggle, 'active', Gio.SettingsBindFlags.DEFAULT);
        settings.bind('enable-custom-color-holiday', holidayColorBtn, 'sensitive', Gio.SettingsBindFlags.DEFAULT);
        holidayColorRow.add_suffix(holidayColorBtn);
        holidayColorRow.add_suffix(holToggle);
        holidayColorRow.activatable_widget = holToggle;
        colorsGroup.add(holidayColorRow);
        
        appPage.add(colorsGroup);

        const datesGroup = new Adw.PreferencesGroup({ title: 'Secondary Dates' });
        const hijriRow = new Adw.SwitchRow({ title: 'Show Islamic Hijri Date' });
        settings.bind('show-hijri', hijriRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        datesGroup.add(hijriRow);

        const gregRow = new Adw.SwitchRow({ title: 'Show Gregorian Date' });
        settings.bind('show-gregorian-sub', gregRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        datesGroup.add(gregRow);
        appPage.add(datesGroup);
        window.add(appPage);

        // --- 2. Events Page ---
        const eventsPage = new Adw.PreferencesPage({
            title: 'Events',
            icon_name: 'x-office-calendar-symbolic'
        });

        const evGroup = new Adw.PreferencesGroup({ title: 'Event Types to Display' });
        
        const evIranianRow = new Adw.SwitchRow({ title: 'Iranian Events' });
        settings.bind('show-events-iranian', evIranianRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        evGroup.add(evIranianRow);

        const evHijriRow = new Adw.SwitchRow({ title: 'Islamic Events' });
        settings.bind('show-events-hijri', evHijriRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        evGroup.add(evHijriRow);

        const evGregRow = new Adw.SwitchRow({ title: 'Gregorian Events' });
        settings.bind('show-events-gregorian', evGregRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        evGroup.add(evGregRow);

        eventsPage.add(evGroup);
        window.add(eventsPage);

        // --- 3. About Page ---
        const aboutPage = new Adw.PreferencesPage({
            title: 'About',
            icon_name: 'help-about-symbolic'
        });
        
        const aboutBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            halign: Gtk.Align.CENTER,
            margin_top: 32,
            margin_bottom: 32
        });

        const iconPath = this.dir.get_child('assets').get_child('logo.png').get_path();
        const logo = new Gtk.Image({
            pixel_size: 128,
            halign: Gtk.Align.CENTER
        });
        logo.set_from_file(iconPath);
        aboutBox.append(logo);

        const titleLabel = new Gtk.Label({
            label: '<span size="xx-large" weight="bold">Jalali Calendar</span>',
            use_markup: true,
            halign: Gtk.Align.CENTER,
            margin_top: 12
        });
        aboutBox.append(titleLabel);

        const versionButton = new Gtk.Button({
            label: VERSION,
            halign: Gtk.Align.CENTER
        });
        versionButton.add_css_class('text-button');
        versionButton.add_css_class('app-version');
        aboutBox.append(versionButton);

        const descLabel = new Gtk.Label({
            label: 'A beautiful Iranian calendar integration for GNOME Shell.',
            halign: Gtk.Align.CENTER,
            justify: Gtk.Justification.CENTER,
            wrap: true,
            margin_top: 12
        });
        aboutBox.append(descLabel);

        const devLabel = new Gtk.Label({
            label: 'Created by <a href="https://mohammad-abbasi.me">Mohammad Abbasi</a>',
            use_markup: true,
            halign: Gtk.Align.CENTER,
            margin_top: 12
        });
        aboutBox.append(devLabel);

        const topGroup = new Adw.PreferencesGroup();
        topGroup.add(aboutBox);
        aboutPage.add(topGroup);

        const linksGroup = new Adw.PreferencesGroup();
        
        const repoRow = new Adw.ActionRow({
            title: 'Repository',
            activatable: true
        });
        const repoIcon = new Gtk.Image({ icon_name: 'adw-external-link-symbolic', valign: Gtk.Align.CENTER });
        repoIcon.add_css_class('dim-label');
        repoRow.add_suffix(repoIcon);
        repoRow.connect('activated', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/mohammadv184/gnome-jalali-calendar', null);
        });
        linksGroup.add(repoRow);

        const issueRow = new Adw.ActionRow({
            title: 'Report an Issue',
            activatable: true
        });
        const issueIcon = new Gtk.Image({ icon_name: 'adw-external-link-symbolic', valign: Gtk.Align.CENTER });
        issueIcon.add_css_class('dim-label');
        issueRow.add_suffix(issueIcon);
        issueRow.connect('activated', () => {
            Gio.AppInfo.launch_default_for_uri('https://github.com/mohammadv184/gnome-jalali-calendar/issues', null);
        });
        linksGroup.add(issueRow);

        aboutPage.add(linksGroup);

        window.add(aboutPage);
    }
}
