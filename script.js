// import cors from 'cors';
// import express from 'express';

// const app = express()
// app.use(cors({ origin: 'http://localhost:5500' }))
import dotenv from 'dotenv';

dotenv.config();

const CLIENT_ID = process.env.CLIENT_ID;
const API_KEY = process.env.API_KEY;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID; 
const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

// Variable to hold the access token
let accessToken = "";

// Function to initialize Google Identity Services and request access token
function initTokenClient() {
    const tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (response) => {
            if (response.error) {
                console.error("Error obtaining access token:", response.error);
                return;
            }
            accessToken = response.access_token;
            console.log("Access Token received:", accessToken);
        },
    });
    tokenClient.requestAccessToken();
}

// Function to handle ID token and retrieve user info
function handleCredentialResponse(response) {
    const id_token = response.credential;
    console.log("ID Token received:", id_token);

    const parseJwt = (token) => {
        try {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            return JSON.parse(atob(base64));
        } catch (e) {
            console.error("Invalid ID token format.");
            return null;
        }
    };

    const userData = parseJwt(id_token);
    console.log("User data:", userData);

    // Now request access token to access Google Sheets
    initTokenClient();
}

// Function to fetch data from Google Sheets
async function getSheetData(range) {
    if (!accessToken) {
        console.error("Access token is required to access Google Sheets.");
        return;
    }

    const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}`,
        {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }
    );

    if (response.ok) {
        const data = await response.json();
        console.log("Data from Google Sheets:", data.values);
        return data.values;
    } else {
        console.error("Error fetching data:", response.statusText);
    }
}

function displayDataInTable(data) {
    // Get the table element
    const table = document.getElementById("dataTable");
    
    // Remove any existing rows (except the header)
    const rows = table.getElementsByTagName("tr");
    for (let i = rows.length - 1; i > 0; i--) {
        table.deleteRow(i);
    }

    // Loop through the data (starting from index 1 to skip headers)
    for (let i = 1; i < data.length; i++) {
        // Create a new row
        const row = table.insertRow();

        // Insert data into each cell of the row
        for (let j = 0; j < data[i].length; j++) {
            const cell = row.insertCell();
            cell.textContent = data[i][j]; // Set the cell text
        }
    }
}

async function appendToSheet(rowData) {
    if (!accessToken) {
        console.error("Access token is required to access Google Sheets.");
        return;
    }

    const range = "Sheet1!A:F"; // The range where data is to be appended
    const valueInputOption = "RAW"; // Set this to "RAW" to append values as entered

    const cleanedRowData = rowData.map(value => {
        return !isNaN(value) && value !== '' ? Number(value) : value; // Convert to number if it's numeric
    });

    const resource = {
        values: [cleanedRowData], // Send the cleaned row data
    };

    try {
        const response = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${range}:append?valueInputOption=${valueInputOption}`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(resource),
            }
        );

        if (response.ok) {
            alert("Data appended successfully.");
            return await response.json(); // Returns the response
        } else {
            const errorData = await response.json();
            console.error("Error appending data:", response.statusText, errorData);
        }
    } catch (error) {
        console.error("Error in appending data:", error);
    }
}
// Function to handle form submission
document.getElementById("marksForm").onsubmit = async (event) => {
    event.preventDefault(); // Prevent the form from submitting normally

    // Get values from the form
    const regNo = document.getElementById("regNo").value;
    const name = document.getElementById("name").value;
    const marks = document.getElementById("marks").value;
    const total = document.getElementById("total").value;

    // // Calculate the percentage
    // const percentage = (marks / total) * 100;
    // const status = percentage >= 50 ? "Pass" : "Fail"; // Define pass/fail logic

    // Prepare the row data
    const rowData = [regNo, name, marks, total];

    // Append data to Google Sheets
    await appendToSheet(rowData);

    // setTimeout(async () => {
    //     const data = await getSheetData('Sheet1!A1:F');
    //     displayDataInTable(data);
    // }, 1000); 

    // Optionally, clear the form fields after submission
    document.getElementById("marksForm").reset();
};

document.getElementById("fetchSheetDataButton").onclick = async () => {
    try {
        const data = await getSheetData('Sheet1!A1:F'); // Wait for the data
        console.log("Data returned", data);
        displayDataInTable(data); // Now that we have the data, display it
    } catch (error) {
        console.error("Error getting or displaying data:", error);
    }
};
