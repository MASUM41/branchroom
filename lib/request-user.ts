// Production identity comes from the Sites dispatch layer. Never from request JSON.
export function requestUser(request:Request){
  const userId=request.headers.get('oai-authenticated-user-id');
  const email=request.headers.get('oai-authenticated-user-email');
  return userId&&email?{userId,email}:null;
}
