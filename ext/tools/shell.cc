// Copyright 2008 Google Inc. All Rights Reserved.
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above
//       copyright notice, this list of conditions and the following
//       disclaimer in the documentation and/or other materials provided
//       with the distribution.
//     * Neither the name of Google Inc. nor the names of its
//       contributors may be used to endorse or promote products derived
//       from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

// FIXME: use c++ instead of c libs
// FIXME: get stack trace when v8 is fixed
#include <cerrno>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <dirent.h>
#include <libgen.h>
#include <string>
#include <sstream>
#include <sys/stat.h>
#include <sys/types.h>
#include <unistd.h>
#include <v8.h>
#include <vector>

#define ASSERT_NUM_ARGS(num_args)                                                    \
    if (args.Length() != num_args) {                                                 \
        return v8::ThrowException(v8::String::New(FormatArgsError(num_args, args))); \
    }

static const char* FormatArgsError(const int num_expected, const v8::Arguments& args);

static bool ExecuteString(v8::Handle<v8::String> source,
                             v8::Handle<v8::Value> name,
                             bool print_result);
static void ProcessRuntimeFlags(int argc, char* argv[]);
static v8::Handle<v8::Value> ReadFile(const char* name);
static void RunShell(v8::Handle<v8::Context> context);

static v8::Handle<v8::Value> Basename(const v8::Arguments& args);
static v8::Handle<v8::Value> DirExists(const v8::Arguments& args);
static v8::Handle<v8::Value> Dirname(const v8::Arguments& args);
static v8::Handle<v8::Value> Getenv(const v8::Arguments& args);
static v8::Handle<v8::Value> Load(const v8::Arguments& args);
static v8::Handle<v8::Value> Ls(const v8::Arguments &args);
static v8::Handle<v8::Value> Mkdir(const v8::Arguments &args);
static v8::Handle<v8::Value> Print(const v8::Arguments& args);
static v8::Handle<v8::Value> Quit(const v8::Arguments& args);
static v8::Handle<v8::Value> ReadFile(const v8::Arguments &args);
static v8::Handle<v8::Value> Realpath(const v8::Arguments& args);
static v8::Handle<v8::Value> Version(const v8::Arguments& args);
static v8::Handle<v8::Value> WriteFile(const v8::Arguments& args);

int main(int argc, char* argv[])
{
    v8::V8::SetFlagsFromCommandLine(&argc, argv, true);
    v8::HandleScope handle_scope;

    v8::Handle<v8::ObjectTemplate> global = v8::ObjectTemplate::New();
    global->Set(v8::String::New("basename"), v8::FunctionTemplate::New(Basename));
    global->Set(v8::String::New("dir_exists"), v8::FunctionTemplate::New(DirExists));
    global->Set(v8::String::New("dirname"), v8::FunctionTemplate::New(Dirname));
    global->Set(v8::String::New("getenv"), v8::FunctionTemplate::New(Getenv));
    global->Set(v8::String::New("load"), v8::FunctionTemplate::New(Load));
    global->Set(v8::String::New("ls"), v8::FunctionTemplate::New(Ls));
    global->Set(v8::String::New("mkdir"), v8::FunctionTemplate::New(Mkdir));
    global->Set(v8::String::New("print"), v8::FunctionTemplate::New(Print));
    global->Set(v8::String::New("quit"), v8::FunctionTemplate::New(Quit));
    global->Set(v8::String::New("read_file"), v8::FunctionTemplate::New(ReadFile));
    global->Set(v8::String::New("realpath"), v8::FunctionTemplate::New(Realpath));
    global->Set(v8::String::New("version"), v8::FunctionTemplate::New(Version));
    global->Set(v8::String::New("write_file"), v8::FunctionTemplate::New(WriteFile));

    // Create a new execution environment containing the built-in
    // functions
    v8::Handle<v8::Context> context = v8::Context::New(NULL, global);
    // Enter the newly created execution environment.
    v8::Context::Scope context_scope(context);
    if (argc > 1) {
        const char* str = argv[1];
        v8::Handle<v8::String> file_name = v8::String::New(str);
        v8::Handle<v8::String> source = ReadFile(str)->ToString();
        if (source.IsEmpty()) {
            printf("Error reading '%s'\n", str);
            return 1;
        }
        v8::Local<v8::Array> arguments = v8::Array::New(argc-2);
        for (int i = 0; i < argc-2; i++) {
            arguments->Set(v8::Number::New(i), v8::String::New(argv[i+2]));
        }
        context->Global()->Set(v8::String::New("arguments"), arguments);

        if (!ExecuteString(source, file_name, false)) {
            printf("Error executing '%s'\n", str);
            return 1;
        }
    }
    else {
        RunShell(context);
    }
    return 0;
}


static const char* FormatArgsError(const int num_expected, const v8::Arguments& args)
{
    std::ostringstream error;
    error << "Expecting " << num_expected
          << " argument" << ((num_expected > 0) ? "s" : "")
          << ", but got " << args.Length();
    return error.str().c_str();
}


// Prints its arguments on stdout separated by spaces and ending with a
// newline.
static v8::Handle<v8::Value> Print(const v8::Arguments& args)
{
    if (args.Length() > 0) {
        v8::String::AsciiValue first(args[0]);
        printf("%s", *first);
    }
    for (int i = 1; i < args.Length(); i++) {
        v8::String::AsciiValue rest(args[i]);
        printf(" %s", *rest);
    }
    printf("\n");
    return v8::Undefined();
}



// Loads, compiles and executes its argument JavaScript file.
static v8::Handle<v8::Value> Load(const v8::Arguments& args) {
    for (int i = 0; i < args.Length(); i++) {
        v8::HandleScope handle_scope;
        v8::String::AsciiValue file(args[i]);
        v8::Handle<v8::String> source = ReadFile(*file)->ToString();
        ExecuteString(source, v8::String::New(*file), false);
    }
    return v8::Undefined();
}


// Quits.
static v8::Handle<v8::Value> Quit(const v8::Arguments& args) {
    // If arguments are not supplied, args[0] will yield undefined, which
    // converts to the integer value 0.
    int exit_code = args[0]->Int32Value();
    exit(exit_code);
    return v8::Undefined();
}


static v8::Handle<v8::Value> Version(const v8::Arguments& args) {
    return v8::String::New(v8::V8::GetVersion());
}


// Reads a file into a v8 string.
static v8::Handle<v8::Value> ReadFile(const char* name) {
    FILE* file = fopen(name, "rb");
    if (file == NULL) {
        std::string error("Error reading file: ");
        error += name;
        return v8::ThrowException(v8::String::New(error.c_str()));
    }

    fseek(file, 0, SEEK_END);
    int size = ftell(file);
    rewind(file);

    char* chars = new char[size + 1];
    chars[size] = '\0';
    for (int i = 0; i < size;) {
        int read = fread(&chars[i], 1, size - i, file);
        i += read;
    }
    fclose(file);
    v8::Handle<v8::String> result = v8::String::New(chars, size);
    delete[] chars;
    return result;
}

static v8::Handle<v8::Value> Getenv(const v8::Arguments& args) {
    ASSERT_NUM_ARGS(1);

    v8::String::AsciiValue name(args[0]);
    const char* value = getenv(*name);
    if (value == NULL) {
        return v8::Undefined();
    }
    return v8::String::New(value);
}

static v8::Handle<v8::Value> Dirname(const v8::Arguments& args) {
    ASSERT_NUM_ARGS(1);
    v8::String::AsciiValue path(args[0]);
    return v8::String::New(dirname(*path));
}

static v8::Handle<v8::Value> Basename(const v8::Arguments& args) {
    ASSERT_NUM_ARGS(1);
    v8::String::AsciiValue path(args[0]);
    return v8::String::New(basename(*path));
}


static v8::Handle<v8::Value> Realpath(const v8::Arguments& args) {
    ASSERT_NUM_ARGS(1);
    v8::String::AsciiValue path(args[0]);
    return v8::String::New(realpath(*path, NULL));
}

static v8::Handle<v8::Value> ReadFile(const v8::Arguments& args) {
    ASSERT_NUM_ARGS(1);
    v8::String::AsciiValue file(args[0]);
        return ReadFile(*file)->ToString();
    return v8::Undefined();
}

static v8::Handle<v8::Value> WriteFile(const v8::Arguments& args) {
    ASSERT_NUM_ARGS(2);

    v8::String::AsciiValue path(args[0]);
    FILE* file = fopen(*path, "w");
    if (file == NULL) {
        std::string error("Error opening file: ");
        error += *path;
        return v8::ThrowException(v8::String::New(error.c_str()));
    }
    v8::Local<v8::String> contents = v8::String::Cast(*args[1]);
    const int size = contents->Length();
    char* chars = new char[size];
    contents->WriteAscii(chars, 0, size);
    fwrite(chars, 1, size, file);
    fclose(file);
    delete[] chars;
    return v8::Undefined();
}

static v8::Handle<v8::Value> DirExists(const v8::Arguments& args) {
    ASSERT_NUM_ARGS(1);

    v8::String::AsciiValue path(args[0]);
    struct stat buf;
    if (stat(*path, &buf) == 0) {
        return v8::True();
    }

    if (errno == ENOENT) {
        return v8::False();
    }

    return v8::ThrowException(v8::String::New(strerror(errno)));
}


static v8::Handle<v8::Value> Mkdir(const v8::Arguments& args) {
    if (args.Length() == 0) {
        return v8::ThrowException(v8::String::New("Expected at least 1 argument"));
    }

    v8::String::AsciiValue path(args[0]);

    mode_t oct_mode;
    if (args.Length() == 2) {
        v8::String::AsciiValue mode(args[1]);
        std::string mode_str(*mode);
        std::istringstream in_mode(mode_str);
        in_mode >> std::oct;
        in_mode >> oct_mode;
    }
    else {
        oct_mode = 0777;
    }

    if (mkdir(*path, oct_mode) == 0) {
        return v8::True();
    }
    return v8::False();
}

static v8::Handle<v8::Value> Ls(const v8::Arguments& args) {
    ASSERT_NUM_ARGS(1);

    DIR *dp;
    struct dirent *ep;

    v8::String::AsciiValue path(args[0]);
    dp = opendir(*path);
    if (dp == NULL) {
        return v8::ThrowException(v8::String::New("Error opening dir"));
    }

    std::vector<const char*> dir_entries;

    while (ep = readdir(dp)) {
        dir_entries.push_back(ep->d_name);
    }
    closedir(dp);

    v8::Handle<v8::Array> entries = v8::Array::New();
    for (int i = 0; i < dir_entries.size(); i++) {
        entries->Set(v8::Number::New(i), v8::String::New(dir_entries[i]));
    }
    return entries;
}


// The read-eval-execute loop of the shell.
static void RunShell(v8::Handle<v8::Context> context) {
    printf("V8 version %s\n", v8::V8::GetVersion());
    static const int kBufferSize = 256;
    while (true) {
        char buffer[kBufferSize];
        printf("> ");
        char* str = fgets(buffer, kBufferSize, stdin);
        if (str == NULL) break;
        v8::HandleScope handle_scope;
        ExecuteString(v8::String::New(str), v8::Undefined(), true);
    }
    printf("\n");
}

// Executes a string within the current v8 context.
static bool ExecuteString(v8::Handle<v8::String> source,
                          v8::Handle<v8::Value> name,
                          bool print_result) {
    v8::HandleScope handle_scope;
    v8::TryCatch try_catch;
    v8::Handle<v8::Script> script = v8::Script::Compile(source, name);
    if (script.IsEmpty()) {
        // Print errors that happened during compilation.
        v8::String::AsciiValue error(try_catch.Exception());
        printf("%s\n", *error);
        return false;
    }
    else {
        v8::Handle<v8::Value> result = script->Run();
        if (result.IsEmpty()) {
            // Print errors that happened during execution.
            v8::String::AsciiValue error(try_catch.Exception());
            v8::Local<v8::Message> message = try_catch.Message();
            v8::String::AsciiValue script(message->GetScriptResourceName());
            v8::String::AsciiValue line(message->GetSourceLine());
            printf("%s\nOccured in %s line %i\n%s\n", *error, *script, message->GetLineNumber(), *line);
            return false;
        }
        else {
            if (print_result && !result->IsUndefined()) {
                // If all went well and the result wasn't undefined then print
                // the returned value.
                v8::String::AsciiValue str(result);
                printf("%s\n", *str);
            }
            return true;
        }
    }
}
