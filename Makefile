UUID = jalali-calendar@mohammad-abbasi.me
FILES = extension.js jalali.js events.js metadata.json prefs.js stylesheet.css schemas config.js assets/fonts assets/logo.png
ZIP_FILE = $(UUID).zip
INSTALL_DIR = ~/.local/share/gnome-shell/extensions/$(UUID)

VERSION ?= dev

.PHONY: all build install clean lint

lint:
	@echo "Running ESLint..."
	npx eslint .


all: build

build: clean
	@echo "Compiling schemas..."
	glib-compile-schemas schemas/
	@echo "Preparing build directory..."
	rm -rf build_tmp
	mkdir -p build_tmp
	cp --parents -r $(FILES) build_tmp/
	sed -i 's/@@VERSION@@/$(VERSION)/g' build_tmp/config.js
	@echo "Packing extension into $(ZIP_FILE)..."
	cd build_tmp && zip -qr ../$(ZIP_FILE) * -x "schemas/gschemas.compiled"
	rm -rf build_tmp

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
	rm -rf build_tmp
