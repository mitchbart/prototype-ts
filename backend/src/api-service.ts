import axios from 'axios';
import https from 'https';
import { authService } from './auth-service';
import { config } from './config';
import { ApiError } from './custom-errors';

interface UpdateParameterOptions {
    crusherId: number;
    parameterName: string;
    value: number;
}

// Needs to be done to get around SSL error - is there a way to get around needing to do this?
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

class ApiService {
    // Constructor with calls for to config purely for readability
    private readonly baseUrl: string;
    private readonly apiVersion: string;

    constructor() {
        this.baseUrl = config.api.destinationApiUrl;
        this.apiVersion = config.api.version;
    }

    // Health check checks connection to api before proceeding with main function
    async healthCheck(): Promise<boolean> {
        try {
            const token = await authService.getValidToken();
            // Make a GET request to the base API URL
            await axios({
                method: 'GET',
                url: `${this.baseUrl}/api/crushers?api-version=${this.apiVersion}`,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                httpsAgent
            });
            return true;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`API health check failed: Status ${error.response?.status}`);
            } else {
                console.error('API health check failed:', error instanceof Error ? error.message : 'unknown error');
            }
            return false;
        }
    }

    async updateParameter({ crusherId, parameterName, value }: UpdateParameterOptions): Promise<void> {
        try {
            const token = await authService.getValidToken(); // Get token
            const url = `${this.baseUrl}/api/crushers/BIN${crusherId}/interfaces/CITEC/parameters/${parameterName}?api-version=${this.apiVersion}`;
            // const url = `${config.api.destinationApiUrl}/api/crushers/BIN${crusherId}/interfaces/CITEC/parameters/${parameterName}?api-version=${config.api.version}`; // Build url for patch
            
            //Send patch request to api, store response
            const response = await axios({
                method: 'PATCH',
                url,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                data: { value },
                httpsAgent
            });

            // May need to add additional success checks with other api's
            if (response.status === 200) {
                console.log(`Successfully updated parameter ${parameterName} for crusher ${crusherId}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new ApiError(
                    'update',
                    crusherId,
                    parameterName,
                    `Status: ${error.response?.status}, Details: ${JSON.stringify(error.response?.data)}`
                );
            }
            throw new ApiError(
                'update',
                crusherId,
                parameterName,
                error instanceof Error ? error.message : 'unknown error'
            );
        }
    }
}

export const apiService = new ApiService();