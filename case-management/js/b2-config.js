// Backblaze B2 Configuration
const b2Config = {
    applicationKeyId: '0053b3001ccd7450000000001',
    applicationKey: 'K005LSPtZw+NdkrMtD2VknVjpuAxs04',
    bucketId: '331ba3d0c0318ccc9d570415',
    bucketName: 'knoscases',
    endpoint: 'https://s3.us-east-005.backblazeb2.com', // Replace with your endpoint
};

// Helper function to get authorization token
async function getB2AuthToken() {
    const authString = btoa(`${b2Config.applicationKeyId}:${b2Config.applicationKey}`);
    
    try {
        const response = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
            headers: {
                'Authorization': `Basic ${authString}`
            }
        });

        if (!response.ok) throw new Error('Authorization failed');
        
        const auth = await response.json();
        return {
            authorizationToken: auth.authorizationToken,
            apiUrl: auth.apiUrl,
            downloadUrl: auth.downloadUrl
        };
    } catch (error) {
        console.error('B2 authorization error:', error);
        throw error;
    }
}

// Helper function to get upload URL
async function getUploadUrl(authToken, apiUrl) {
    try {
        const response = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
            method: 'POST',
            headers: {
                'Authorization': authToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                bucketId: b2Config.bucketId
            })
        });

        if (!response.ok) throw new Error('Failed to get upload URL');
        
        return await response.json();
    } catch (error) {
        console.error('B2 get upload URL error:', error);
        throw error;
    }
}

// Helper function to upload file to B2
async function uploadFileToB2(file, uploadUrl, uploadAuthToken) {
    try {
        const response = await fetch(uploadUrl, {
            method: 'POST',
            headers: {
                'Authorization': uploadAuthToken,
                'Content-Type': file.type,
                'X-Bz-File-Name': encodeURIComponent(file.name),
                'X-Bz-Content-Sha1': 'do_not_verify' // In production, calculate actual SHA1
            },
            body: file
        });

        if (!response.ok) throw new Error('Upload failed');
        
        return await response.json();
    } catch (error) {
        console.error('B2 upload error:', error);
        throw error;
    }
}

// Main upload function
async function uploadToB2(file) {
    try {
        const auth = await getB2AuthToken();
        const uploadUrlData = await getUploadUrl(auth.authorizationToken, auth.apiUrl);
        const uploadResult = await uploadFileToB2(file, uploadUrlData.uploadUrl, uploadUrlData.authorizationToken);
        
        return {
            fileId: uploadResult.fileId,
            fileName: uploadResult.fileName,
            downloadUrl: `${auth.downloadUrl}/file/${b2Config.bucketName}/${uploadResult.fileName}`
        };
    } catch (error) {
        console.error('B2 upload process error:', error);
        throw error;
    }
}
