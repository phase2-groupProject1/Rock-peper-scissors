# Penjelasan controllers/socketController.js

File ini berisi semua logika utama untuk fitur real-time game Rock Paper Scissors (RPS) menggunakan Socket.IO. Semua kode di sini bertugas menangani event dari client (seperti join room, kirim move, dan disconnect), mengatur data sementara di memori, dan MENYIMPAN hasil ronde ke database (tabel `Moves`).

## Struktur Data
- `rooms`: Object untuk menyimpan data setiap room. Setiap room menyimpan:
  - `names`: mapping dari socketId ke nama player
  - `moves`: mapping dari socketId ke move (rock/paper/scissors)

## Kelas SocketGameController
Semua fungsi utama ditulis dalam bentuk static method di dalam class ini. Di dalamnya juga ada integrasi Sequelize (`Move`, `Room`, `User`).

### 1. getRoom(roomId)
- Jika room belum ada, buat object baru untuk room tersebut.
- Return object room (isi names & moves).

### 2. decideWinner(a, b)
- Menentukan pemenang antara dua move:
  - Jika sama, hasilnya draw.
  - Jika a mengalahkan b (misal: rock vs scissors), return 'a'.
  - Jika b mengalahkan a, return 'b'.

### 3. onJoinRoom(io, socket, body)
- Dipanggil saat client mengirim event `join_room`.
- Ambil roomId dan nama player dari body.
- Masukkan socket ke room, simpan nama player di room.
- Emit event `joined_room` ke client yang join.
- Tulis log ke terminal.

Tambahan untuk DB:
- Jika client mengirim `roomId` angka (mis. 5) maka disimpan ke `socket.data.roomDbId = 5`.
- Jika client mengirim `roomCode` (string), controller akan cari ke DB (`Rooms.room_code`) lalu simpan `roomDbId` bila ketemu.
- Jika client mengirim `userId`, disimpan di memory (`rooms[userId]`) dan di `socket.data.userId`. Ini akan dipakai saat menyimpan ronde ke DB.

### 4. onPlayerMove(io, socket, body)
- Dipanggil saat client mengirim event `player_move`.
- Validasi move (harus rock/paper/scissors).
- Simpan move player di room.
- Jika sudah ada 2 player yang submit move:
  - Ambil kedua move dan nama player.
  - Tentukan pemenang dengan decideWinner.
  - Kirim event `round_result` ke semua client di room (isi: kedua move, siapa pemenang, dll).
  - Reset moves di room agar bisa main lagi.
- Tulis log ke terminal.

Simpan ke DB (best effort):
- Jika tersedia salah satu dari `roomDbId` atau `userId1/2`, controller akan `Move.create({
  Room_id, User_id_1, User_id_2, User_id_1_choice, User_id_2_choice, result
})`.
- Field `result` diisi: `'draw'`, `'User_id_1'`, atau `'User_id_2'` (menandai siapa pemenang relatif ke urutan pemain 1/2 pada ronde itu).
- Jika tidak ada `roomDbId` dan tidak ada `userId` dari kedua pemain, penyimpanan DB di-skip (supaya tidak fail).

### 5. onDisconnect(socket, reason)
- Dipanggil saat client disconnect.
- Hapus data player dari room.
- Jika room kosong, hapus room dari memory.
- Tulis log ke terminal.

### 6. init(io)
- Fungsi utama untuk mendaftarkan semua event handler ke Socket.IO.
- Setiap client yang connect akan:
  - Didaftarkan event handler untuk join_room, player_move, dan disconnect.
  - Tulis log connect ke terminal.

### Export
- File ini diexport sebagai function yang menerima io, lalu memanggil SocketGameController.init(io).
- Ini supaya mudah dipanggil dari app.js.

---

## Inti Penggunaan
- Semua data hanya disimpan di memory (tidak ke database).
- Semua event penting (join, move, result, disconnect) akan muncul di terminal lewat console.log.
- File ini hanya fokus ke logika game dan komunikasi real-time, tidak mengatur user/room di database.

Pembaharuan: hasil pertandingan kini disimpan ke DB (tabel `Moves`) jika informasi `roomDbId` atau `userId` tersedia.

Contoh body dari client:
- Join room dengan id numerik dan user id:
```json
{ "roomId": 5, "userId": 10, "playerName": "Alice" }
```
- Join room pakai kode room:
```json
{ "roomCode": "ABC123", "userId": 11, "playerName": "Bob" }
```
- Kirim move:
```json
{ "move": "rock" }
```

Catatan:
- Agar `Room_id` di tabel `Moves` terisi, pastikan `roomId` numerik yang valid atau `roomCode` yang ada di DB dikirim saat `join_room`.
- Jika hanya `userId` yang dikirim (tanpa room valid), data tetap tersimpan (Room_id bisa null) sehingga riwayat pemain masih tercatat.

Jika ingin menambah fitur lain (misal: simpan ke database), bisa tambahkan di method yang sesuai.
