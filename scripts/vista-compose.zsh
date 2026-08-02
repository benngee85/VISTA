#!/usr/bin/env zsh

emulate -L zsh
setopt ERR_EXIT NO_UNSET PIPE_FAIL ALLEXPORT

readonly repo_root="${0:A:h:h}"
cd "${repo_root}"

for env_file in \
  .env \
  .env.node \
  .env.local \
  .secrets/runtime.env
do
  [[ -f "${env_file}" ]] && source "${env_file}"
done

unset COMPOSE_FILE
unset COMPOSE_PATH_SEPARATOR

required_variables=(
  CACHE_REST_TOKEN
  VALKEY_PASSWORD
)

for variable_name in "${required_variables[@]}"; do
  if [[ -z "${(P)variable_name:-}" ]]; then
    print -u2 -r -- \
      "ERROR: ${variable_name} is missing after loading protected environment files."
    exit 1
  fi
done

exec docker compose "$@"
