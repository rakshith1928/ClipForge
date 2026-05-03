import urllib.request
import os

os.makedirs(".stitch/designs", exist_ok=True)

html_url = "https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzNmNzNhZTMwMWFhODQwNWU4N2Q0NmEwNmJjMTk2YmE3EgsSBxDPqp3PlQcYAZIBJAoKcHJvamVjdF9pZBIWQhQxNjgwMjIyODE1ODA0NDE4NTc1MA&filename=&opi=96797242"
req = urllib.request.Request(html_url, headers={'Accept-Encoding': 'identity'})
with urllib.request.urlopen(req) as response:
    html = response.read()
    with open(".stitch/designs/TranscriptView.html", "wb") as f:
        f.write(html)
        
png_url = "https://lh3.googleusercontent.com/aida/ADBb0ugwKZFmV5e60rQ9O2ePy1fsF-Vhjd_LtCvVTPItOTH_TqwD2HGzRBBrK_m9rieRsHi0PJ-SuG8kXH1W7O88aZbKfnKxf4xIb54_33tf4syli3zZjaE2tD24YUkCuaxtDZ8TnwrawMDz0E6_oobvOtFJEe9XQBgNmEtws1S-KqqipshUwGHMdw2n2yHBwcU5pmMi7OTFPBDE97ydYLqhSXOE2ofcwRYdpBQ03noaPEhi_C9-B34qQ4rkOreK=w2560"
req2 = urllib.request.Request(png_url)
with urllib.request.urlopen(req2) as response:
    with open(".stitch/designs/TranscriptView.png", "wb") as f:
        f.write(response.read())

print("Downloaded successfully.")
