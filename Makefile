UUID = jalali-calendar@mohammad-abbasi.me
FILES = extension.js jalali.js events.js metadata.json prefs.js stylesheet.css schemas assets/fonts
ZIP_FILE = $(UUID).zip
INSTALL_DIR = ~/.local/share/gnome-shell/extensions/$(UUID)

.PHONY: all build install clean

all: build

build: clean
	@echo "Compiling schemas..."
	glib-compile-schemas schemas/
	@echo "Packing extension into $(ZIP_FILE)..."
	zip -qr $(ZIP_FILE) $(FILES) -x "schemas/gschemas.compiled"

install: build
	@echo "Installing extension locally..."
	mkdir -p $(INSTALL_DIR)
	unzip -qo $(ZIP_FILE) -d $(INSTALL_DIR)
	glib-compile-schemas $(INSTALL_DIR)/schemas/
	@echo "Extension installed to $(INSTALL_DIR)."
	@echo "Please restart GNOME Shell and enable it."

clean:
	@echo "Cleaning up..."
	rm -f $(ZIP_FILE)
	rm -f schemas/gschemas.compiled
