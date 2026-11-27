FROM alpine:3 AS site
WORKDIR /site
COPY index.html app.js sw.js styles.css manifest.webmanifest ./
COPY vendor/ vendor/
COPY icons/ icons/
RUN sed -i 's|<head>|<head><meta name="chatgpt-sign-in" content="enabled">|' index.html

FROM quay.io/oauth2-proxy/oauth2-proxy:v7.15.0
COPY --from=site /site /srv/site
CMD ["--http-address=0.0.0.0:4180", "--provider=oidc", "--provider-display-name=ChatGPT", "--oidc-issuer-url=https://auth.openai.com", "--scope=openid profile email", "--code-challenge-method=S256", "--insecure-oidc-skip-nonce=false", "--cookie-secure=true", "--cookie-samesite=lax", "--email-domain=*", "--upstream=file:///srv/site/#/", "--skip-auth-route=GET=^/$", "--skip-auth-route=GET=^/(index\\.html|app\\.js|sw\\.js|styles\\.css|manifest\\.webmanifest|icons/.*|vendor/.*)$", "--request-logging=false"]
