.PHONY: help install dev start docker-build docker-up docker-down docker-logs reset-db

# Default: tampilkan daftar perintah.
help: ## Tampilkan bantuan
	@echo "NusaTrip — Travel Assistant Chatbot"
	@echo ""
	@echo "Mode lokal (tanpa Docker):"
	@echo "  make install      Install dependencies (npm install)"
	@echo "  make dev          Jalankan server dengan auto-reload (npm run dev)"
	@echo "  make start        Jalankan server production (npm start)"
	@echo ""
	@echo "Mode Docker:"
	@echo "  make docker-build Build image Docker"
	@echo "  make docker-up    Jalankan container (background)"
	@echo "  make docker-down  Stop & hapus container"
	@echo "  make docker-logs  Lihat log container (live)"
	@echo ""
	@echo "Utilitas:"
	@echo "  make reset-db     Hapus memory chat (chat.db lokal)"
	@echo ""
	@echo "Prasyarat: salin .env berisi GEMINI_API_KEY (lihat README)."

install: ## Install dependencies
	npm install

dev: ## Jalankan server mode development (auto-reload)
	npm run dev

start: ## Jalankan server mode production
	npm start

docker-build: ## Build image Docker
	docker compose build

docker-up: ## Jalankan container di background
	docker compose up -d
	@echo "App berjalan di http://localhost:3000"

docker-down: ## Stop & hapus container
	docker compose down

docker-logs: ## Lihat log container secara live
	docker compose logs -f app

reset-db: ## Hapus database memory chatbot lokal
	rm -f chat.db
	@echo "chat.db dihapus — memory percakapan direset."
