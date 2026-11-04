"""Local-only management read transport. Never prints or exports credentials.

Uses the existing Supabase CLI default profile in Windows Credential Manager.
Only the dedicated read-only endpoint is reachable through this helper.
"""
import ctypes
import ctypes.wintypes as w
import json
import re
import sys
import urllib.request
import urllib.error

PROJECT = 'upxgyusodibaqcrocdzj'
OWNER = 'chianwu@gmail.com'

class Credential(ctypes.Structure):
    _fields_ = [('flags',w.DWORD),('type',w.DWORD),('target',w.LPWSTR),('comment',w.LPWSTR),
        ('written',w.FILETIME),('size',w.DWORD),('blob',ctypes.POINTER(ctypes.c_ubyte)),
        ('persist',w.DWORD),('count',w.DWORD),('attrs',ctypes.c_void_p),('alias',w.LPWSTR),('user',w.LPWSTR)]

def credential():
    lib=ctypes.WinDLL('Advapi32.dll')
    lib.CredReadW.argtypes=[w.LPCWSTR,w.DWORD,w.DWORD,ctypes.POINTER(ctypes.POINTER(Credential))]
    lib.CredReadW.restype=w.BOOL
    lib.CredFree.argtypes=[ctypes.c_void_p]
    pointer=ctypes.POINTER(Credential)()
    if not lib.CredReadW('Supabase CLI:supabase',1,0,ctypes.byref(pointer)):
        raise RuntimeError('personal_management_auth_required')
    try:
        raw=ctypes.string_at(pointer.contents.blob,pointer.contents.size)
        for encoding in ['utf-8','utf-16-le']:
            try:
                value=raw.decode(encoding).rstrip('\x00')
                if re.fullmatch(r'sbp_[A-Za-z0-9]+',value):return value
            except UnicodeDecodeError:pass
        raise RuntimeError('personal_management_auth_invalid')
    finally:lib.CredFree(pointer)

def main():
    data=json.load(sys.stdin)
    query=data.get('query','')
    if not isinstance(query,str) or len(query)>100000 or not re.match(r'^\s*(select|with)\b',query,re.I):
        raise RuntimeError('readonly_query_required')
    token=credential()
    headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'}
    owner=json.load(urllib.request.urlopen(urllib.request.Request('https://api.supabase.com/v1/profile',headers=headers),timeout=15))
    if owner.get('primary_email','').lower()!=OWNER:raise RuntimeError('management_owner_mismatch')
    body=json.dumps({'query':query,'parameters':data.get('parameters',[])},ensure_ascii=False).encode('utf-8')
    request=urllib.request.Request(f'https://api.supabase.com/v1/projects/{PROJECT}/database/query/read-only',headers=headers,data=body,method='POST')
    with urllib.request.urlopen(request,timeout=20) as response:
        result=json.load(response)
    json.dump({'rows':result},sys.stdout,ensure_ascii=False)

if __name__=='__main__':
    try:main()
    except urllib.error.HTTPError as error:
        # Provider diagnostics can include query text; do not reflect it in logs.
        json.dump({'error':'management_read_failed','status':error.code},sys.stdout)
        sys.exit(1)
    except Exception as error:
        allowed={'personal_management_auth_required','personal_management_auth_invalid','readonly_query_required','management_owner_mismatch'}
        json.dump({'error':str(error) if str(error) in allowed else 'management_read_unavailable'},sys.stdout)
        sys.exit(1)
