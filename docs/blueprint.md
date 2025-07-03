# **App Name**: Form AutoFill

## Core Features:

- Upload Form: File Upload: Allow admin to upload vendor registration Excel (.xlsx) forms.
- AI Field Extraction: Field Detection: Use AI as a tool to intelligently detect and extract form field names and their corresponding cell locations within the uploaded Excel file.
- Data Matching: Data Mapping: Utilize AI to match the extracted form fields with the appropriate fields in the Google Sheet 'Vendor Master Data'.
- Sheets Integration: Google Sheets Integration: Establish a secure connection to a specified Google Sheet to fetch the 'Vendor Master Data'.
- File Writing: Excel Writing: Fill the uploaded Excel form with mapped data.
- Download: Download Output: Provide an immediate download link to the user upon the successful completion of data mapping and writing.

## Style Guidelines:

- Primary color: Deep blue (#3F51B5) to inspire trust and security in this admin application.
- Background color: Very light blue (#E8EAF6). A desaturated version of the primary color will give good contrast with the other elements and fit the dark color scheme.
- Accent color: Purple (#9C27B0) for a clear visual call to attention, while remaining closely analogous to the primary hue.
- Font: 'Inter', a sans-serif font, provides a modern, neutral, and easily readable appearance suitable for an admin application.
- Simple single-page layout with clear sections for file upload, processing status, and download link.
- Subtle loading animations to indicate processing, with a clear 'Download Ready' notification upon completion.