import axios from 'axios';
import https from 'https';
import { authService } from './auth-service';
import { config } from './config';

interface UpdateParameterOptions {
    crusherId: number;
    parameterName: string;
    value: number;
}

// Needs to be done to get around SSL error
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

class ApiService {
    // private readonly baseUrl: string;
    // private readonly apiVersion: string;

    // constructor() {
    //     this.baseUrl = config.api.destinationApiUrl;
    //     this.apiVersion = config.api.version;
    // }

    async updateParameter({ crusherId, parameterName, value }: UpdateParameterOptions): Promise<void> {
        try {
            const token = await authService.getValidToken();
            // const url = `${this.baseUrl}/api/crushers/BIN${crusherId}/interfaces/CITEC/parameters/${parameterName}?api-version=${this.apiVersion}`;
            const url = `${config.api.destinationApiUrl}/api/crushers/BIN${crusherId}/interfaces/CITEC/parameters/${parameterName}?api-version=${config.api.version}`;
            
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

            if (response.status === 200) {
                console.log(`Successfully updated parameter ${parameterName} for crusher ${crusherId}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`Error updating parameter ${parameterName} for crusher ${crusherId}:`, {
                    status: error.response?.status,
                    message: error.response?.data
                });
            } else {
                console.error(`Unexpected error updating parameter ${parameterName} for crusher ${crusherId}:`, error);
            }
            throw error;
        }
    }
}

export const apiService = new ApiService();