import axios from 'axios';
import { config } from './config';
import { AuthenticationError } from './custom-errors';

interface AuthToken {
    accessToken: string;
    expiresIn: number;
    obtainedAt: number;
}

class AuthenticationService {
    private currentToken: AuthToken | null = null;

    private async fetchNewToken(): Promise<AuthToken> {
        try {
            const authConfig = {
                url: config.auth.destinationAuthUrl,
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                data: new URLSearchParams({
                    grant_type: 'client_credentials',
                    scope: 'modular-web-api',
                    client_id: config.auth.clientId,
                    client_secret: config.auth.clientSecret
                }).toString()
            };

            const response = await axios(authConfig);

            const { access_token, expires_in } = response.data;
            
            const token = {
                accessToken: access_token,
                expiresIn: expires_in,
                obtainedAt: Date.now()
            };

            // Log the new token details - testing only
            // this.logTokenDetails(token);
            
            return token;
        } catch (error) {
            if (axios.isAxiosError(error)) { // Find out the proper way to pass axios details to error message
                // console.log(error);
                console.log("Unable to fetch authentication token");
                throw new AuthenticationError(
                    `Status: ${error.response?.status}, Details: ${JSON.stringify(error.response?.data)}`
                );
            }
            throw new AuthenticationError(error instanceof Error ? error.message : 'unknown error')
        }
    }

    // Check if token is expired
    private isTokenExpired(): boolean {
        if (!this.currentToken) return true;

        const now = Date.now();
        const expirationTime = this.currentToken.obtainedAt + (this.currentToken.expiresIn * 1000);
        // Return true if token is expired or will expire in the next minute
        return now >= (expirationTime - 60000);
    }

    // Function only for testing to log and check token
    private logTokenDetails(token: AuthToken): void {
        const expirationDate = new Date(token.obtainedAt + (token.expiresIn * 1000));
        console.log('\nNew Authentication Token Obtained');
        console.log('----------------------------------------');
        console.log(`Access Token: ${token.accessToken}`);
        console.log(`Expires In: ${token.expiresIn} seconds`);
        console.log(`Obtained At: ${new Date(token.obtainedAt).toLocaleString()}`);
        console.log(`Expires At: ${expirationDate.toLocaleString()}`);
        console.log('----------------------------------------\n');
    }

    // Get token
    async getValidToken(): Promise<string> {
        // If token is expired or doesn't exist, fetch a new token
        if (this.isTokenExpired()) {
            this.currentToken = await this.fetchNewToken();
        } else {
            // Log remaining validity time for existing token
            const remainingTime = Math.floor(
                (this.currentToken!.obtainedAt + (this.currentToken!.expiresIn * 1000) - Date.now()) / 1000
            );
            // console.log(`Using existing token (expires in ${remainingTime} seconds)`); // Log for testing
        }
        return this.currentToken!.accessToken;
    }
}

export const authService = new AuthenticationService();