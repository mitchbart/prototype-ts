import axios from 'axios';
import https from 'https';
import { authService } from './auth-service';
import { config } from './config';
import { ApiError, HealthCheckError } from './custom-errors';

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
    private readonly maxRetries: number = 3; // Maximum number of retry attempts
    private readonly baseDelay: number = 1000; // Base delay in milliseconds (1 second)

    constructor() {
        this.baseUrl = config.api.destinationApiUrl;
        this.apiVersion = config.api.version;
    }

    // Exponential backoff delay for retries
    private async delay(retryCount: number): Promise<void> {
        // Exponential backoff
        // const jitter = Math.random() * 200; // Random delay between 0-200ms
        const delayTime = (Math.pow(2, retryCount) * this.baseDelay);
        await new Promise(resolve => setTimeout(resolve, delayTime));
    }

    // Health check checks connection to api before proceeding with main function
    async apiHealthCheck(): Promise<void> {
        try {
            const token = await authService.getValidToken();
            const response = await axios({
                method: 'GET',
                url: `${this.baseUrl}/api/crushers?api-version=${this.apiVersion}`,
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                httpsAgent
            });
            
            if (response.status !== 200) {
                throw new HealthCheckError('API', `Unexpected status code: ${response.status}`);
            }
        } catch (error) {
            throw new HealthCheckError('API', error instanceof Error ? error.message : 'unknown error');
        }
    }

    async updateParameter({ crusherId, parameterName, value }: UpdateParameterOptions): Promise<void> {
        let retryCount = 0; // Number retries
        const maxAttempts = this.maxRetries + 1;
        while (retryCount < maxAttempts) {
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
                    // console.log(`Successfully updated parameter ${parameterName} for crusher ${crusherId}`);
                    console.log(`Successfully updated crusher ${crusherId} parameter ${parameterName}`);
                }
                
                return; // Success condition met - exit loop
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    if (error.response?.status === 429) { // Retry if rate limited
                        retryCount++; // Increment retry count
                        console.log(`Rate Limited Exceeded: Retry attempt ${retryCount} of ${this.maxRetries}`);
                        await this.delay(retryCount); // Add delay time
                        continue; // Back to beginning of loop
                    } 
                    //console.error(error.response);
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
}

export const apiService = new ApiService();