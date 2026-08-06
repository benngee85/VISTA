#!/bin/sh

# Classifies only successful, zero-exit seeder output.
#
# stdout:
#   ok
#   skipped
#
# Non-zero exits, timeouts, configuration blocks and graceful deferrals remain
# the responsibility of run-seeders.sh.

classify_zero_exit_seed_output() {
  classifier_output="${1:-}"
  classifier_last="${2:-}"

  if printf '%s\n' "$classifier_output" |
    grep -Eq '"event"[[:space:]]*:[[:space:]]*"seed_complete"'
  then
    if printf '%s\n' "$classifier_output" |
      grep -Eq '"skipped"[[:space:]]*:[[:space:]]*true'
    then
      printf '%s\n' 'skipped'
      return 0
    fi

    if printf '%s\n' "$classifier_output" |
      grep -Eq '"skipped"[[:space:]]*:[[:space:]]*false'
    then
      printf '%s\n' 'ok'
      return 0
    fi
  fi

  if printf '%s\n' "$classifier_last" |
    grep -Eq 'persisted=[1-9][0-9]*[[:space:]].*failed=0'
  then
    printf '%s\n' 'ok'
    return 0
  fi

  if printf '%s\n' "$classifier_last" |
    grep -Eq 'generated=[1-9][0-9]*[[:space:]].*failed=0'
  then
    printf '%s\n' 'ok'
    return 0
  fi

  if printf '%s\n' "$classifier_last" |
    grep -Eq 'generated=0[[:space:]].*skipped=[1-9][0-9]*[[:space:]].*failed=0'
  then
    printf '%s\n' 'skipped'
    return 0
  fi

  if printf '%s\n' "$classifier_last" |
    grep -Eqi \
      'skipped publish|no prior .* skipped|explicit skip|nothing to publish'
  then
    printf '%s\n' 'skipped'
    return 0
  fi

  if printf '%s\n' "$classifier_last" |
    grep -Eqi \
      '(^|[[:space:][:punct:]])skip(ped)?([[:space:][:punct:]]|$)'
  then
    printf '%s\n' 'skipped'
    return 0
  fi

  printf '%s\n' 'ok'
}
