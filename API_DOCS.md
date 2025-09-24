# API Documentation

## Base URL

```
http://localhost:3000
```

---

## Endpoints

### 1. Register User

- **URL:** `/users`
- **Method:** `POST`
- **Description:** Register user baru.
- **Request Body:**

  ```json
  {
    "username": "string" // required
  }
  ```
- **Success Response:**
  - **Code:** 201
  - **Content:**
    ```json
    {
      "message": "User registered successfully",
      "user": {
        "id": 1,
        "username": "your_username"
      }
    }
    ```
- **Error Response:**
  - **Code:** 400
  - **Content:** `{ "message": "Username is required" }`
  - **Code:** 500
  - **Content:** `{ "message": "Internal server error", "error": "..." }`

---

### 2. Get User by ID

- **URL:** `/users/:id`
- **Method:** `GET`
- **Description:** Mengambil data user berdasarkan id.
- **URL Params:**
  - `id` (integer, required): ID user
- **Success Response:**
  - **Code:** 200
  - **Content:**
    ```json
    {
      "id": 1,
      "username": "your_username"
    }
    ```
- **Error Response:**
  - **Code:** 404
  - **Content:** `{ "message": "User not found" }`
  - **Code:** 500
  - **Content:** `{ "message": "Internal server error", "error": "..." }`

---

## Catatan
- Semua response dikirim dalam format JSON.
- Pastikan header `Content-Type: application/json` pada request POST.
