(require 'cl)
(require 'compile)
(require 'json)
(require 'pp)
(require 'url)
(require 'url-http)

(defgroup firejuice nil
  "firejuice"
  :group 'firejuice)

(defcustom *firejuice:download-directory* "/tmp/firejuice"
  "Where firejuice should store downloaded files."
  :type '(string)
  :group 'firejuice)

(defconst *firejuice:errors-buffer-name* "*firejuice:errors*"
  "The name of the errors buffer")

(defun firejuice:intersperse (delim seq)
  (reduce (lambda (a b) (format (concat "%s" delim "%s") a b)) seq))

(defun firejuice:unique-download-directory ()
  (firejuice:intersperse "/" (cons *firejuice:download-directory* (current-time))))

(defun firejuice:transform-errors (download-dir errors)
  (map 'vector
       '(lambda (err)
          (firejuice:transform-error download-dir err))
       errors))

(defun firejuice:transform-error (download-dir error)
  (map 'list
       '(lambda (lst)
          (let ((name (car lst)))
            (cond ((eq name 'stack)
                   (cons 'stack (firejuice:transform-stack download-dir (cdr lst))))
                  ((eq name 'cause)
                   (cons 'cause (firejuice:transform-error download-dir (cdr lst))))
                  ('t lst))))
       error))


(defun firejuice:file-path (download-dir uri)
  (let* ((path-without-host-and-scheme (replace-regexp-in-string "^http://.+/js/" "js/" uri))
         (path-without-slashes (replace-regexp-in-string "/" "!" path-without-host-and-scheme)))
    (concat download-dir "/" path-without-slashes)))

(defun firejuice:download-uri (download-dir uri)
  (let ((file-path (firejuice:file-path download-dir uri)))
    (unless (file-exists-p file-path)
      (let ((url-request-method "GET")
            (url-request-extra-headers nil)
            (url-mime-accept-string "*/*")))
      (with-current-buffer (url-retrieve-synchronously uri)
        (delete-region (point-min) (1+ url-http-end-of-headers))
        (write-file file-path)))
    file-path))

(defun firejuice:transform-stack (download-dir stack)
  (map 'vector
       '(lambda (frame)
          (let* ((truncated-frame (firejuice:truncate-error-in-frame frame))
                 (uri-association (assoc 'uri truncated-frame))
                 (file (if (not uri-association)
                           "nil"
                         (firejuice:download-uri download-dir (cdr uri-association)))))
            (append truncated-frame (list (cons 'file file)))))
       stack))

(defun firejuice:truncate (str)
  (if (>= (length str) 80)
      (concat (substring str 0 80) "...")
    str))

(defun firejuice:truncate-error-in-frame (frame)
  (map 'list
       '(lambda (association)
          (if (eq (car association) 'error)
              (cons 'error (firejuice:truncate (cdr association)))
            association))
       frame))

(defun firejuice:handle-json-errors (json-file-path)
  (interactive "fPath to json errors: ")
  (let ((errors (json-read-file json-file-path))
        (download-dir (firejuice:unique-download-directory)))
    (when (file-exists-p download-dir)
      (error "Download directory (%s) already exists" download-dir))
    (make-directory download-dir 't)
    (message "Created download directory: %s." download-dir)
    ;; Kill old buffer
    (when (get-buffer *firejuice:errors-buffer-name*)
      (message "Killing old buffer")
      (kill-buffer *firejuice:errors-buffer-name*))
    (let ((buffer (get-buffer-create *firejuice:errors-buffer-name*)))
      (message "Printing to buffer")
      (pp (firejuice:transform-errors download-dir errors) buffer)
      (message "Switching to buffer")
      (switch-to-buffer buffer)
      (goto-char 0)
      (compilation-mode))))


(add-to-list 'compilation-error-regexp-alist-alist '(firejuice "((line \. \"\\([0-9]+\\)\")\\(?:\n.+?\\)*[ ]+(file \. \"\\([^\"]+\\)\"))" 2 1))
(add-to-list 'compilation-error-regexp-alist 'firejuice)

(provide 'firejuice)
