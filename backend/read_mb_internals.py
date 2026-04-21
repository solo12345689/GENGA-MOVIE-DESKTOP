import moviebox_api.v1.requests as req
import moviebox_api.v1.constants as const
import inspect

src_req = inspect.getsource(req)
src_const = inspect.getsource(const)

with open("mb_requests_source.py", "w", encoding="utf-8") as f:
    f.write(src_req)

with open("mb_constants_source.py", "w", encoding="utf-8") as f:
    f.write(src_const)
