# Havai HR Backend

This is the backend for the Havai HR system.

## Getting Started

To get the server running, follow these steps:

1.  Install the dependencies:
    ```bash
    npm install
    ```

2.  Apply the database migrations:
    ```bash
    npx prisma migrate dev --name init
    ```

3.  Start the development server:
    ```bash
    npm run dev
    ```

The server will be running on http://localhost:3000.

## Roles

- `ADMIN`: Can perform all CRUD operations on users.
- `USER`: Can only update their own profile.

## API

### Auth

- `POST /auth/register`: Register a new user. Default role is `USER`.
- `POST /auth/login`: Login with email and password.
- `GET /auth/me`: Get the current user's profile.
- `PATCH /auth/me`: Update the current user's profile.

### Users (Admin only)

- `GET /users`: List all users.
- `GET /users/:id`: Get a user by ID.
- `POST /users`: Create a new user.
- `PATCH /users/:id`: Update a user.
- `DELETE /users/:id`: Delete a user.
- `POST /users/bulk-delete`: Bulk delete users.