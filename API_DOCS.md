# API Documentation

Dokumen ini menjelaskan REST API dan Socket.IO events untuk backend Rock–Paper–Scissors (RPS) dengan mode Player vs Player dan Player vs AI (Gemini).

## Base URL

```
http://localhost:3000
```

## Environment Variables

Tambahkan ke file `.env` (nilai default akan digunakan jika tidak di-set):

- `GEMINI_API_KEY` — API key untuk Google AI Studio (jika kosong, AI akan menggunakan random fallback)
- `GEMINI_MODEL` — default: `gemini-1.5-flash-latest`
- `GEMINI_API_VERSION` — default: `v1beta`
- `GEMINI_MIN_INTERVAL_MS` — default: `800` (cooldown minimal antar panggilan Gemini)
- `GEMINI_CACHE_TTL_MS` — default: `15000` (cache AI singkat untuk menghindari request duplikat)

Catatan: layanan Gemini gratis tetap memiliki kuota dan rate limit. Jika limit terpenuhi, server akan melakukan retry dengan backoff, dan bila masih gagal akan fallback ke AI random dengan insight yang menjelaskan penyebabnya.

---

## REST API

### Health Check
- `GET /`
- Response 200
  ```json
  { "status": "RPS server running", "socket": "ws://localhost:3000" }
  ```

### Register User
- `POST /users`
- Body
  ```json
  { "username": "string" }
  ```
- Responses
  - 201
    ```json
    { "message": "User registered successfully", "user": { "id": 1, "username": "your_username" } }
    ```
  - 400 `{ "message": "Username is required" }`

### Get User by ID
- `GET /users/:id`
- Responses
  - 200 `{ "id": 1, "username": "your_username" }`
  - 404 `{ "message": "User not found" }`

### List Rooms
- `GET /rooms`
- Responses
  - 200 `{ "rooms": [ { "id": 1, "room_code": "ABC123", ... }, ... ] }`

### Create Room
- `POST /rooms`
- Responses
  - 201 `{ "room": { "id": 1, "room_code": "ABC123", ... } }`

### Room Details
- `GET /rooms/:room_code`
- Responses
  - 200 `{ "room": { "id": 1, "room_code": "ABC123", ... } }`
  - 404 `{ "error": "Room not found" }`

### Join Room (REST)
- `POST /rooms/:room_code/join`
- Body
  ```json
  { "user_id": 8 }
  ```
- Responses
  - 200 `{ "message": "Successfully joined the room" }`
  - 400 `{ "error": "User ID is required" }`
  - 404 `{ "error": "Room not found" }`

### Play vs AI (REST)
- `POST /rooms/:room_code/ai`
- Body
  ```json
  { "user_id": 8, "player_move": "rock" }
  ```
- Responses
  - 200
    ```json
    {
      "player_move": "rock",
      "ai_move": "paper",
      "result": "lose",
      "insights": "text from Gemini or fallback reason"
    }
    ```
  - 404 `{ "error": "Room not found" }`
  - 500 `{ "error": "Internal server error" }`

---

## Socket.IO API

- Namespace: default
- URL: `ws://localhost:3000`

### Client → Server: `join_room`
Join room untuk mode PvP atau set konteks room untuk PvAI.

Payload:
```json
{
  "roomId": "W2LJ51",         // atau "room" / "roomCode"
  "playerName": "wada",        // optional
  "userId": 8                   // optional (untuk persist ke DB bila tersedia)
}
```

Server → Client event: `joined_room`
```json
{ "room": "W2LJ51", "playerName": "wada", "userId": 8, "roomDbId": 1 }
```

### Client → Server: `player_move`
Kirim gerakan pemain pada mode PvP (butuh `join_room` terlebih dahulu).

Payload:
```json
{ "move": "rock" }
```

Server → Room: `round_result`
```json
{
  "room": "W2LJ51",
  "players": [
    { "id": "socketA", "name": "Alice", "userId": 8, "move": "rock" },
    { "id": "socketB", "name": "Bob",   "userId": 9, "move": "scissors" }
  ],
  "winnerId": "socketA",          // null jika seri
  "winnerUserId": 8,               // null jika seri
  "winnerName": "Alice",          // null jika seri
  "result": "win" | "draw",
  "message": "Winner: Alice"
}
```

Persistensi: server akan menyimpan hasil ke tabel `Moves` (skema per‑move). Jika tersedia skema gabungan (kolom `User_id_1`, `User_id_2`, dst.), server mencoba menyimpan dalam satu baris; jika gagal, fallback ke dua baris per‑move.

### Client → Server: `play_ai`
Main lawan AI via Socket.IO. Jika sudah `join_room`, konteks room & user diambil dari `socket.data`.

Payload (salah satu field gerakan):
```json
{
  "player_move": "paper",        // atau gunakan "move"
  "userId": 8,                    // optional
  "playerName": "wada",          // optional
  "roomId": "W2LJ51",           // optional kalau sudah join_room
  "roomCode": "W2LJ51"           // alternatif penamaan
}
```

Server → Client (hanya peminta): `round_result`
```json
{
  "room": "W2LJ51",
  "players": [
    { "id": "<your-socket>", "name": "wada", "userId": 8, "move": "paper" },
    { "id": "AI", "name": "AI", "userId": null, "move": "rock" }
  ],
  "winnerId": "<your-socket>" | null,
  "winnerUserId": 8 | null,
  "winnerName": "wada" | "AI" | null,
  "result": "win" | "lose" | "draw",
  "message": "Winner: wada" | "Draw",
  "ai": { "insights": "text dari Gemini atau alasan fallback" }
}
```

Error event umum:
```json
{ "message": "invalid move (rock|paper|scissors)" }
{ "message": "join_room first" }
{ "message": "You're going too fast. Please wait a moment before playing AI again." }
```

---

## AI, Rate Limit, dan Fallback

- Jika `GEMINI_API_KEY` tidak di-set: AI menggunakan random move, dan `ai.insights` menjelaskan alasannya.
- Bila terjadi 429/503 (rate limit sementara): server melakukan retry/backoff. Jika tetap gagal, server akan fallback ke random dan mengembalikan insight seperti: `Gemini rate limit (429). Using random AI.`
- Server juga menerapkan cooldown minimal (konfigurable via `.env`) dan cache singkat agar tidak menembak API berkali‑kali saat user menekan tombol terlalu cepat.

---

## Contoh cURL

Register:
```bash
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"username":"wada"}'
```

Create Room:
```bash
curl -X POST http://localhost:3000/rooms
```

Play vs AI (REST):
```bash
curl -X POST http://localhost:3000/rooms/W2LJ51/ai \
  -H "Content-Type: application/json" \
  -d '{"user_id":8, "player_move":"rock"}'
```

---

## Catatan Tambahan

- Semua response JSON menggunakan `Content-Type: application/json`.
- Socket.IO: gunakan library klien (Postman dapat mengirim event Socket.IO) atau skrip Node klien.
- Hasil permainan akan dicatat ke database jika `roomDbId` dan/atau `userId` tersedia pada konteks request.
