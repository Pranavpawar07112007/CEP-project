# SocietyPay Tracker

## Overview
SocietyPay Tracker is a web application designed to help manage society members, track their payments, and monitor society expenses and other income. It provides a clean, user-friendly interface to ensure maximum readability and approachability.

## Core Features
* **Member Management**: Display and manage a list of society members, including their names, flat numbers, and mobile numbers.
* **Payment Tracking**: Input fields to record payment amounts, payment dates, and the payment mode (Cash or Online). It also supports tracking receipt numbers and transaction IDs.
* **Payment Status Indicators**: Visually highlight members who have paid using simple icons (e.g., checkmarks for paid, exclamation marks for unpaid) to differentiate them from those who haven't. Users can optionally filter based on payment status.
* **Financial Tracking**: Keep records of overall society expenses and other sources of income.
* **Local Storage**: Simulates saving user input data to the browser's local storage.

## Tech Stack
* **Framework**: Next.js (v15.3.8) with React (v18.3.1).
* **Styling**: Tailwind CSS, Tailwind-merge, and Radix UI components (Accordion, Dialog, Popover, etc.).
* **Backend & Database**: Firebase.
* **Forms & Validation**: React Hook Form paired with Zod for schema validation.
* **Data Visualization**: Recharts for rendering charts.
* **Export Tools**: `html2canvas` and `jspdf` for generating downloadable content.
* **Utilities**: `date-fns` for date formatting and manipulation.

## Data Models
The application relies on the following core data structures:
* **Member**: Tracks `id`, `name`, `flatNumber`, and `mobileNumber`.
* **Payment**: Tracks `id`, `memberId`, `amount`, `date`, `receiptNumber`, `paymentMode`, and `transactionId`.
* **Expense**: Tracks `id`, `description`, `amount`, and `date`.
* **OtherIncome**: Tracks `id`, `description`, `amount`, and `date`.

## UI & Design Guidelines
The application follows specific design principles to evoke trust and provide a positive user experience:
* **Primary Color**: Soft blue (`#64B5F6`).
* **Background Color**: Very light blue (`#E3F2FD`).
* **Accent Color**: Soft green (`#A5D6A7`) used for positive affirmation, like received payments.
* **Typography**: *PT Sans*, a versatile sans-serif font used for both headlines and body text.
* **Layout**: A clean, tabular layout is used for the member list and payment information.

## Getting Started

### Available Scripts
In the project directory, you can run the following commands:

* **`npm run dev`**: Starts the development server using Turbopack on port 9002 (`next dev --turbopack -p 9002`).
* **`npm run build`**: Builds the application for production (`next build`).
* **`npm run start`**: Starts the production server (`next start`).
* **`npm run lint`**: Runs the linter (`next lint`).
* **`npm run typecheck`**: Runs TypeScript type checking (`tsc --noEmit`).
