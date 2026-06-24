#!/bin/sh
set -e

: "${SANDPACK_PACKAGE_RESOLVE_MODE:=local-first}"

case "$SANDPACK_PACKAGE_RESOLVE_MODE" in
  offline-only|local-first) ;;
  *)
    echo "Invalid SANDPACK_PACKAGE_RESOLVE_MODE: $SANDPACK_PACKAGE_RESOLVE_MODE"
    exit 1
    ;;
esac

cat > /usr/share/nginx/html/__sandpack_config__.js <<EOF
(function () {
  var scriptUrl =
    document.currentScript && document.currentScript.src
      ? document.currentScript.src
      : window.location.href;

  window.__SANDPACK_RUNTIME_CONFIG__ = {
    packageResolveMode: '$SANDPACK_PACKAGE_RESOLVE_MODE',
    publicBaseUrl: new URL('./', scriptUrl).toString()
  };
})();
EOF

exec nginx -g 'daemon off;'
