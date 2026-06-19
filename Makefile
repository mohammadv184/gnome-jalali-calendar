UUID = jalali-calendar@mohammadv184.github.io
FILES = extension.js jalali.js events.js metadata.json prefs.js stylesheet.css schemas assets/fonts
ZIP_FILE = $(UUID).zip

.PHONY: all build install clean

all: build

build: clean
	@echo "Compiling schemas..."
	glib-compile-schemas schemas/
	@echo "Packing extension into $(ZIP_FILE)..."
	zip -qr $(ZIP_FILE) $(FILES) -x "schemas/gschemas.compiled"

install: build
	@echo "Installing extension locally..."
	mkdir -p ~/.local/share/gnome-shell/extensions/$(UUID)
	unzip -qo $(ZIP_FILE) -d ~/.local/share/gnome-shell/extensions/$(UUID)
	@echo "Extension installed to ~/.local/share/gnome-shell/extensions/$(UUID)."
	@echo "Please restart GNOME Shell and enable it."

clean:
	@echo "Cleaning up..."
	rm -f $(ZIP_FILE)
	rm -f schemas/gschemas.compiled
